import { describe, expect, it } from "vitest";
import { isLowestYet, isNewSale, parsePriceMemory, updatePriceMemory, type PriceMemory } from "./priceMemory";
import type { SteamPrice, SteamStoreItem } from "./steamStore";

const DAY = 86_400_000;
const T0 = Date.parse("2026-11-01T10:00:00Z");

function item(appid: number, price: Partial<SteamPrice> | null): SteamStoreItem {
  const full: SteamPrice = { finalCents: 5999, originalCents: 5999, finalText: "59,99€", originalText: "59,99€", discountPct: 0, discountEndsAt: null };
  return {
    appid,
    name: `App ${appid}`,
    storeUrl: `https://store.steampowered.com/app/${appid}/`,
    releaseDate: null,
    comingSoon: false,
    deck: "unknown",
    reviewLabel: null,
    reviewPercent: null,
    reviewCount: null,
    coverUrl: null,
    free: price === null,
    price: price === null ? null : { ...full, ...price },
  };
}

const sale = (appid: number, finalCents: number, pct: number, endsAt: number | null): SteamStoreItem =>
  item(appid, { finalCents, finalText: `${finalCents / 100}€`, discountPct: pct, discountEndsAt: endsAt });

describe("updatePriceMemory", () => {
  it("starts a row at first sight: the current price is the lowest, and a sale began now", () => {
    const memory = updatePriceMemory(new Map(), [item(1, {}), sale(2, 2999, 50, T0 + 3 * DAY), item(3, null)], T0);
    expect([...memory.keys()]).toEqual([1, 2]);
    expect(memory.get(1)).toMatchObject({ finalCents: 5999, saleSince: null, lowestCents: 5999, lowestText: "59,99€", lowestAt: T0, loadedAt: T0 });
    expect(memory.get(2)).toMatchObject({ finalCents: 2999, discountPct: 50, saleSince: T0, lowestCents: 2999, lowestText: "29.99€", lowestAt: T0 });
  });

  it("keeps when a running sale began, even at a different percentage, and forgets it once the sale ends", () => {
    const first = updatePriceMemory(new Map(), [sale(2, 2999, 50, T0 + 3 * DAY)], T0);
    const deeper = updatePriceMemory(first, [sale(2, 1999, 67, T0 + 3 * DAY)], T0 + DAY);
    expect(deeper.get(2)).toMatchObject({ saleSince: T0, finalCents: 1999, lowestCents: 1999, lowestAt: T0 + DAY });
    const over = updatePriceMemory(deeper, [item(2, {})], T0 + 5 * DAY);
    expect(over.get(2)).toMatchObject({ saleSince: null, finalCents: 5999, lowestCents: 1999, lowestText: "19.99€", lowestAt: T0 + DAY });
  });

  it("counts a sale as new when the previous one had ended before this load, or had no end and was over", () => {
    const first = updatePriceMemory(new Map(), [sale(2, 2999, 50, T0 + 3 * DAY)], T0);
    const later = updatePriceMemory(first, [sale(2, 3599, 40, T0 + 12 * DAY)], T0 + 10 * DAY);
    expect(later.get(2)?.saleSince).toBe(T0 + 10 * DAY);
    const open = updatePriceMemory(new Map(), [sale(2, 2999, 50, null)], T0);
    expect(updatePriceMemory(open, [sale(2, 2999, 50, null)], T0 + 10 * DAY).get(2)?.saleSince).toBe(T0);
  });

  it("drops rows for games no longer priced in this load", () => {
    const first = updatePriceMemory(new Map(), [item(1, {}), item(2, {})], T0);
    expect([...updatePriceMemory(first, [item(2, {})], T0 + DAY).keys()]).toEqual([2]);
  });
});

describe("marks", () => {
  const row: PriceMemory = { appid: 2, finalCents: 2999, originalCents: 5999, discountPct: 50, discountEndsAt: null, finalText: "", saleSince: T0, lowestCents: 2999, lowestText: "", lowestAt: T0, loadedAt: T0 };

  it("a sale is new when it began after the last look, including for someone who never looked", () => {
    expect(isNewSale(row, 0)).toBe(true);
    expect(isNewSale(row, T0 - 1)).toBe(true);
    expect(isNewSale(row, T0)).toBe(false);
    expect(isNewSale({ ...row, saleSince: null }, 0)).toBe(false);
    expect(isNewSale(undefined, 0)).toBe(false);
  });

  it("the current price is the lowest yet when nothing cheaper was seen", () => {
    expect(isLowestYet(row)).toBe(true);
    expect(isLowestYet({ ...row, lowestCents: 1999 })).toBe(false);
  });
});

describe("parsePriceMemory", () => {
  it("reads a stored document back, fills what is missing, and skips rows without the essentials", () => {
    const stored = { version: 1, rows: [{ appid: 2, finalCents: 2999, lowestCents: 1999, saleSince: T0, discountEndsAt: null }, { appid: 0, finalCents: 1 }, { finalCents: 1, lowestCents: 1 }, "x"] };
    expect(parsePriceMemory(stored)).toEqual([
      { appid: 2, finalCents: 2999, originalCents: 2999, discountPct: 0, discountEndsAt: null, finalText: "", saleSince: T0, lowestCents: 1999, lowestText: "", lowestAt: 0, loadedAt: 0 },
    ]);
    expect(parsePriceMemory(undefined)).toEqual([]);
    expect(parsePriceMemory([{ appid: 3, finalCents: 100, lowestCents: 100 }])).toHaveLength(1);
  });
});
