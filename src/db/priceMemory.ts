/**
 * SQL for the desktop app's price memory (`steam_prices`, migration 12): the
 * rows of one store region, and the statements that replace them after a
 * load. Pure, so the SQL tests run it against a real database.
 */
import type { PriceMemory } from "../domain/priceMemory";
import { lit } from "./sql";

export interface PriceMemoryRow {
  appid: number;
  final_cents: number;
  original_cents: number;
  discount_pct: number;
  discount_ends_at: number | null;
  final_text: string;
  sale_since: number | null;
  lowest_cents: number;
  lowest_text: string;
  lowest_at: number;
  loaded_at: number;
}

export function selectPriceMemory(country: string): string {
  return `SELECT appid, final_cents, original_cents, discount_pct, discount_ends_at, final_text, sale_since, lowest_cents, lowest_text, lowest_at, loaded_at FROM steam_prices WHERE country = ${lit(country)} ORDER BY appid`;
}

export function priceMemoryFromRow(row: PriceMemoryRow): PriceMemory {
  return {
    appid: row.appid,
    finalCents: row.final_cents,
    originalCents: row.original_cents,
    discountPct: row.discount_pct,
    discountEndsAt: row.discount_ends_at,
    finalText: row.final_text,
    saleSince: row.sale_since,
    lowestCents: row.lowest_cents,
    lowestText: row.lowest_text,
    lowestAt: row.lowest_at,
    loadedAt: row.loaded_at,
  };
}

/** Statements that replace the region's rows with these, meant to run as one batch. */
export function priceMemoryStatements(country: string, rows: Iterable<PriceMemory>): string[] {
  return [
    `DELETE FROM steam_prices WHERE country = ${lit(country)}`,
    ...[...rows].map(
      (r) =>
        `INSERT INTO steam_prices (country, appid, final_cents, original_cents, discount_pct, discount_ends_at, final_text, sale_since, lowest_cents, lowest_text, lowest_at, loaded_at) VALUES (${lit(country)}, ${r.appid}, ${r.finalCents}, ${r.originalCents}, ${r.discountPct}, ${lit(r.discountEndsAt)}, ${lit(r.finalText)}, ${lit(r.saleSince)}, ${r.lowestCents}, ${lit(r.lowestText)}, ${r.lowestAt}, ${r.loadedAt})`,
    ),
  ];
}
