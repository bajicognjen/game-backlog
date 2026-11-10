/** The automatic backups of the web build live in IndexedDB; only the newest seven stay. */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { getDocument, listDocumentKeys } from "../db/webStorage";
import { autoBackupFolder, writeAutoBackup } from "./autoBackup";

beforeEach(() => {
  indexedDB = new IDBFactory() as unknown as typeof indexedDB;
});

describe("writeAutoBackup in a browser", () => {
  it("keeps one document per day and prunes beyond seven", async () => {
    for (let day = 1; day <= 9; day++) {
      await writeAutoBackup(`{"day":${day}}`, new Date(2026, 10, day, 9));
      await writeAutoBackup(`{"day":${day},"later":true}`, new Date(2026, 10, day, 21));
    }
    const keys = await listDocumentKeys("backups/");
    expect(keys).toEqual([3, 4, 5, 6, 7, 8, 9].map((day) => `backups/auto-2026-11-0${day}.json`));
    expect(await getDocument("backups/auto-2026-11-09.json")).toBe('{"day":9,"later":true}');
  });

  it("has no folder to show outside the desktop app", async () => {
    expect(await autoBackupFolder()).toBeNull();
  });
});
