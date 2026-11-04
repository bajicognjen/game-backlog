import type Database from "@tauri-apps/plugin-sql";
import { SEED_SETTINGS, buildSeedGames } from "../domain/seed";
import { insertGameStatement } from "./games";
import { settingsStatements, upsertSetting } from "./settings";
import { runBatch } from "./sql";

/**
 * Load the seed data on the very first run. Returns true when it seeded.
 * The whole seed is one transaction, and a `seeded` flag is written with it,
 * so a crash halfway through cannot leave a half-filled database.
 */
export async function ensureSeeded(db: Database): Promise<boolean> {
  const flag = await db.select<{ value: string }[]>("SELECT value FROM settings WHERE key = 'seeded'");
  if (flag.length > 0) return false;

  const [{ count }] = await db.select<{ count: number }[]>("SELECT COUNT(*) AS count FROM games");
  if (count > 0) {
    // Data exists without the flag (e.g. a restored backup); never seed over it.
    await db.execute(upsertSetting("seeded", "1"));
    return false;
  }

  await runBatch(db, [
    ...settingsStatements(SEED_SETTINGS),
    ...buildSeedGames().map(insertGameStatement),
    upsertSetting("seeded", "1"),
  ]);
  return true;
}
