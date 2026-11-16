import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { getDocument } from "../db/webStorage";
import type { PriceMemory } from "../domain/priceMemory";
import { createMemoryPriceMemory, createWebPriceMemory, WEB_PRICES_PREFIX, type PriceMemoryStore } from "./priceMemory";

beforeEach(() => {
  indexedDB = new IDBFactory() as unknown as typeof indexedDB;
});

const row = (appid: number, finalCents: number): PriceMemory => ({
  appid,
  finalCents,
  originalCents: 5999,
  discountPct: 50,
  discountEndsAt: 1795208400000,
  finalText: "29,99€",
  saleSince: 1763000000000,
  lowestCents: finalCents,
  lowestText: "29,99€",
  lowestAt: 1763000000000,
  loadedAt: 1763000000000,
});

function roundTrips(name: string, make: () => PriceMemoryStore) {
  describe(name, () => {
    it("starts empty, keeps what was saved per region, and replaces a region's rows whole", async () => {
      const store = make();
      expect(await store.load("RS")).toEqual(new Map());
      await store.save("RS", new Map([[1, row(1, 2999)], [2, row(2, 1999)]]));
      await store.save("DE", new Map([[1, row(1, 3499)]]));
      expect(await store.load("RS")).toEqual(new Map([[1, row(1, 2999)], [2, row(2, 1999)]]));
      await store.save("RS", new Map([[2, row(2, 1799)]]));
      expect([...(await store.load("RS")).keys()]).toEqual([2]);
      expect((await store.load("DE")).get(1)?.finalCents).toBe(3499);
    });

    it("hands out a copy: changing the loaded map does not change what is kept", async () => {
      const store = make();
      await store.save("RS", new Map([[1, row(1, 2999)]]));
      (await store.load("RS")).clear();
      expect((await store.load("RS")).size).toBe(1);
    });
  });
}

roundTrips("web price memory", createWebPriceMemory);
roundTrips("in-memory price memory", createMemoryPriceMemory);

it("the web store keeps one versioned document per region", async () => {
  await createWebPriceMemory().save("RS", new Map([[1, row(1, 2999)]]));
  expect(await getDocument(`${WEB_PRICES_PREFIX}RS`)).toEqual({ version: 1, rows: [row(1, 2999)] });
});
