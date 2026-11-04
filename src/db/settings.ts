import { SEED_SETTINGS } from "../domain/seed";
import type { Settings, Theme } from "../domain/types";
import { getDb } from "./client";
import { lit } from "./sql";

const KEYS: Record<keyof Settings, string> = {
  startDate: "start_date",
  hoursPerWeek: "hours_per_week",
  theme: "theme",
};

export async function loadSettings(): Promise<Settings> {
  const db = await getDb();
  const rows = await db.select<{ key: string; value: string }[]>("SELECT key, value FROM settings");
  const map = new Map(rows.map((row) => [row.key, row.value]));
  const hoursPerWeek = Number(map.get(KEYS.hoursPerWeek));
  return {
    startDate: map.get(KEYS.startDate) ?? SEED_SETTINGS.startDate,
    hoursPerWeek: Number.isFinite(hoursPerWeek) && hoursPerWeek > 0 ? hoursPerWeek : SEED_SETTINGS.hoursPerWeek,
    theme: (map.get(KEYS.theme) as Theme | undefined) ?? SEED_SETTINGS.theme,
  };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const db = await getDb();
  for (const [field, value] of Object.entries(patch) as [keyof Settings, Settings[keyof Settings]][]) {
    await db.execute(upsertSetting(KEYS[field], String(value)));
  }
}

/** Statements that store every setting (used by the first-run seed and by import). */
export function settingsStatements(settings: Settings): string[] {
  return [
    upsertSetting(KEYS.startDate, settings.startDate),
    upsertSetting(KEYS.hoursPerWeek, String(settings.hoursPerWeek)),
    upsertSetting(KEYS.theme, settings.theme),
  ];
}

/** SQL for inserting or replacing one settings row. */
export function upsertSetting(key: string, value: string): string {
  return `INSERT INTO settings (key, value) VALUES (${lit(key)}, ${lit(value)}) ON CONFLICT(key) DO UPDATE SET value = excluded.value`;
}
