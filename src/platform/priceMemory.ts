/**
 * Where the price memory (`domain/priceMemory.ts`) is kept: the `steam_prices`
 * table inside the Tauri app, a `steam-prices/<country>` document in the web
 * build's IndexedDB, and plain memory where there is neither (the unit tests).
 * One region's rows are replaced whole after every wishlist load.
 */
import { isTauri } from "@tauri-apps/api/core";
import { getDb } from "../db/client";
import { priceMemoryFromRow, priceMemoryStatements, selectPriceMemory, type PriceMemoryRow } from "../db/priceMemory";
import { runBatch } from "../db/sql";
import { getDocument, hasIndexedDb, putDocument } from "../db/webStorage";
import { parsePriceMemory, type PriceMemory } from "../domain/priceMemory";

export interface PriceMemoryStore {
  load(country: string): Promise<Map<number, PriceMemory>>;
  save(country: string, rows: ReadonlyMap<number, PriceMemory>): Promise<void>;
}

const toMap = (rows: readonly PriceMemory[]) => new Map(rows.map((row) => [row.appid, row]));

const sqlitePriceMemory: PriceMemoryStore = {
  async load(country) {
    const db = await getDb();
    return toMap((await db.select<PriceMemoryRow[]>(selectPriceMemory(country))).map(priceMemoryFromRow));
  },
  async save(country, rows) {
    await runBatch(await getDb(), priceMemoryStatements(country, rows.values()));
  },
};

export const WEB_PRICES_PREFIX = "steam-prices/";

export function createWebPriceMemory(): PriceMemoryStore {
  return {
    async load(country) {
      return toMap(parsePriceMemory(await getDocument(WEB_PRICES_PREFIX + country)));
    },
    async save(country, rows) {
      await putDocument(WEB_PRICES_PREFIX + country, { version: 1, rows: [...rows.values()] });
    },
  };
}

export function createMemoryPriceMemory(): PriceMemoryStore {
  const kept = new Map<string, Map<number, PriceMemory>>();
  return {
    async load(country) {
      return new Map(kept.get(country) ?? []);
    },
    async save(country, rows) {
      kept.set(country, new Map(rows));
    },
  };
}

export const priceMemoryStore: PriceMemoryStore = isTauri() ? sqlitePriceMemory : hasIndexedDb() ? createWebPriceMemory() : createMemoryPriceMemory();
