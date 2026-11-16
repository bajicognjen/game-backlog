/**
 * What Steam last charged for each wishlisted game, kept between loads so the
 * app can tell a sale that appeared since the user last looked, and the
 * lowest price it has seen. A cache rebuilt from Steam, never in backups.
 * This module is pure; where the rows are kept lives in `platform/priceMemory.ts`.
 */
import type { SteamStoreItem } from "./steamStore";

export interface PriceMemory {
  appid: number;
  /** The price as last loaded. */
  finalCents: number;
  originalCents: number;
  discountPct: number;
  discountEndsAt: number | null;
  finalText: string;
  /** When the current discount was first seen (epoch ms); null at full price. */
  saleSince: number | null;
  /** The lowest price loaded so far, as Steam formatted it, and when it was seen. */
  lowestCents: number;
  lowestText: string;
  lowestAt: number;
  /** When this row was last refreshed (epoch ms). */
  loadedAt: number;
}

/**
 * The memory after a load at `now`: one row per priced item, carrying over
 * when its sale began and the lowest price seen. A sale continues from the
 * previous load unless that one had already ended by now; a game without a
 * price (free, unreleased, delisted) keeps no row.
 */
export function updatePriceMemory(previous: ReadonlyMap<number, PriceMemory>, items: readonly SteamStoreItem[], now: number): Map<number, PriceMemory> {
  const next = new Map<number, PriceMemory>();
  for (const item of items) {
    const price = item.price;
    if (!price) continue;
    const before = previous.get(item.appid);
    const onSale = price.discountPct > 0;
    const previousSaleRunning = before !== undefined && before.saleSince !== null && (before.discountEndsAt === null || before.discountEndsAt > now);
    const lowest =
      before !== undefined && before.lowestCents <= price.finalCents
        ? { cents: before.lowestCents, text: before.lowestText, at: before.lowestAt }
        : { cents: price.finalCents, text: price.finalText, at: now };
    next.set(item.appid, {
      appid: item.appid,
      finalCents: price.finalCents,
      originalCents: price.originalCents,
      discountPct: price.discountPct,
      discountEndsAt: price.discountEndsAt,
      finalText: price.finalText,
      saleSince: onSale ? (previousSaleRunning ? before.saleSince : now) : null,
      lowestCents: lowest.cents,
      lowestText: lowest.text,
      lowestAt: lowest.at,
      loadedAt: now,
    });
  }
  return next;
}

/** Whether the row's sale appeared after the user last looked at the wishlist (`seenAt`, epoch ms; 0 for never). */
export function isNewSale(row: PriceMemory | undefined, seenAt: number): boolean {
  return row !== undefined && row.saleSince !== null && row.saleSince > seenAt;
}

/** Whether the row's current price is the lowest this app has seen for it. */
export function isLowestYet(row: PriceMemory): boolean {
  return row.finalCents <= row.lowestCents;
}

/** The rows of a stored document (`{ rows: [...] }` or a bare list); anything unreadable is left out. */
export function parsePriceMemory(value: unknown): PriceMemory[] {
  const list = Array.isArray(value) ? value : typeof value === "object" && value !== null && Array.isArray((value as { rows?: unknown }).rows) ? (value as { rows: unknown[] }).rows : [];
  return list.flatMap((raw) => {
    const row = parseRow(raw);
    return row ? [row] : [];
  });
}

function parseRow(raw: unknown): PriceMemory | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const int = (v: unknown) => (typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : null);
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  const appid = int(r.appid);
  const finalCents = int(r.finalCents);
  const lowestCents = int(r.lowestCents);
  if (appid === null || appid === 0 || finalCents === null || lowestCents === null) return null;
  return {
    appid,
    finalCents,
    originalCents: int(r.originalCents) ?? finalCents,
    discountPct: int(r.discountPct) ?? 0,
    discountEndsAt: int(r.discountEndsAt),
    finalText: text(r.finalText),
    saleSince: int(r.saleSince),
    lowestCents,
    lowestText: text(r.lowestText),
    lowestAt: int(r.lowestAt) ?? 0,
    loadedAt: int(r.loadedAt) ?? 0,
  };
}
