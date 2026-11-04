import type Database from "@tauri-apps/plugin-sql";

export type SqlValue = string | number | boolean | null | undefined;

/**
 * Render a value as an SQL literal. Used only to build batched statements
 * (see `runBatch`); single statements should use bind parameters instead.
 */
export function lit(value: SqlValue): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`Cannot store non-finite number ${value}`);
    return String(value);
  }
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${value.replace(/'/g, "''")}'`;
}

/**
 * Run several statements atomically.
 *
 * tauri-plugin-sql has no transaction API, but one `execute` call runs on one
 * pooled connection, so wrapping the statements in BEGIN/COMMIT inside a
 * single call makes them a real SQLite transaction.
 */
export async function runBatch(db: Database, statements: readonly string[]): Promise<void> {
  if (statements.length === 0) return;
  const sql = ["BEGIN;", ...statements.map(terminate), "COMMIT;"].join("\n");
  try {
    await db.execute(sql);
  } catch (error) {
    try {
      await db.execute("ROLLBACK;");
    } catch {
      // No transaction open on this connection; nothing to roll back.
    }
    throw error;
  }
}

function terminate(statement: string): string {
  const trimmed = statement.trim();
  return trimmed.endsWith(";") ? trimmed : `${trimmed};`;
}
