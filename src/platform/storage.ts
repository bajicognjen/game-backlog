import { isTauri } from "@tauri-apps/api/core";
import { hasIndexedDb, isStoragePersisted, requestPersistentStorage } from "../db/webStorage";

/** Where the data lives, for the settings panel. */
export type DataLocation =
  /** The SQLite file in the app's config folder. */
  | { kind: "desktop" }
  /** This browser's IndexedDB; `persisted` says whether the browser has promised to keep it (null when it cannot say). */
  | { kind: "browser"; persisted: boolean | null };

/** Null where there is neither (the unit tests). */
export async function dataLocation(): Promise<DataLocation | null> {
  if (isTauri()) return { kind: "desktop" };
  if (!hasIndexedDb()) return null;
  return { kind: "browser", persisted: await isStoragePersisted() };
}

/** Ask the browser to keep the data, then report the new state. */
export async function keepDataPersistent(): Promise<DataLocation | null> {
  await requestPersistentStorage();
  return dataLocation();
}
