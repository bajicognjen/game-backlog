import Database from "@tauri-apps/plugin-sql";

/** Must match `DB_URL` in `src-tauri/src/lib.rs`, where migrations are registered. */
export const DB_URL = "sqlite:backlog.db";

let dbPromise: Promise<Database> | null = null;

/** Open the database once and share the handle. */
export function getDb(): Promise<Database> {
  if (!dbPromise) dbPromise = Database.load(DB_URL);
  return dbPromise;
}
