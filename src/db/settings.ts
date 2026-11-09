import { SEED_SETTINGS } from "../domain/seed";
import { parseHiddenApps } from "../domain/steam";
import { parseDismissedHints } from "../domain/steamHints";
import type { Settings, Theme } from "../domain/types";
import { getDb } from "./client";
import { lit } from "./sql";

const KEYS: Record<keyof Settings, string> = {
  startDate: "start_date",
  hoursPerWeek: "hours_per_week",
  theme: "theme",
  igdbClientId: "igdb_client_id",
  igdbClientSecret: "igdb_client_secret",
  igdbAccessToken: "igdb_access_token",
  igdbTokenExpiresAt: "igdb_token_expires_at",
  steamApiKey: "steam_api_key",
  steamId: "steam_id",
  steamHiddenApps: "steam_hidden_apps",
  steamDismissedHints: "steam_dismissed_hints",
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
    igdbClientId: map.get(KEYS.igdbClientId) ?? "",
    igdbClientSecret: map.get(KEYS.igdbClientSecret) ?? "",
    igdbAccessToken: map.get(KEYS.igdbAccessToken) ?? "",
    igdbTokenExpiresAt: Number(map.get(KEYS.igdbTokenExpiresAt) ?? 0) || 0,
    steamApiKey: map.get(KEYS.steamApiKey) ?? "",
    steamId: map.get(KEYS.steamId) ?? "",
    steamHiddenApps: parseHiddenApps(map.get(KEYS.steamHiddenApps)),
    steamDismissedHints: parseDismissedHints(map.get(KEYS.steamDismissedHints)),
  };
}

export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const db = await getDb();
  for (const [field, value] of Object.entries(patch) as [keyof Settings, Settings[keyof Settings]][]) {
    // Lists are stored as JSON; everything else as its plain text.
    await db.execute(upsertSetting(KEYS[field], Array.isArray(value) ? JSON.stringify(value) : String(value)));
  }
}

/**
 * Statements that store the plan settings (used by the first-run seed and by
 * import). Credentials and tokens are deliberately left out: a restore must
 * not wipe them.
 */
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
