import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { deleteDocument, getDocument, hasIndexedDb, listDocumentKeys, putDocument } from "./webStorage";

beforeEach(() => {
  // A fresh, empty browser database for every test.
  indexedDB = new IDBFactory() as unknown as typeof indexedDB;
});

describe("webStorage", () => {
  it("is available once fake-indexeddb is loaded", () => {
    expect(hasIndexedDb()).toBe(true);
  });

  it("stores and reads back a document, and overwrites it on a second put", async () => {
    expect(await getDocument("state")).toBeUndefined();
    await putDocument("state", { games: [1, 2] });
    expect(await getDocument("state")).toEqual({ games: [1, 2] });
    await putDocument("state", { games: [3] });
    expect(await getDocument("state")).toEqual({ games: [3] });
  });

  it("lists the keys under a prefix in order and deletes one", async () => {
    await putDocument("backups/auto-2026-11-02.json", "b");
    await putDocument("backups/auto-2026-11-01.json", "a");
    await putDocument("state", {});
    expect(await listDocumentKeys("backups/")).toEqual(["backups/auto-2026-11-01.json", "backups/auto-2026-11-02.json"]);
    await deleteDocument("backups/auto-2026-11-01.json");
    expect(await listDocumentKeys("backups/")).toEqual(["backups/auto-2026-11-02.json"]);
    expect(await getDocument("backups/auto-2026-11-02.json")).toBe("b");
  });
});
