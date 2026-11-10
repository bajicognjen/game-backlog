/**
 * IndexedDB for the web build: one database with one object store of
 * documents keyed by name. The app state lives under `state` (see
 * `webRepository.ts`), the automatic backups under `backups/<file>`.
 *
 * Each call opens the database, runs one request in its own transaction and
 * closes again; writes resolve once the transaction has committed.
 */
const DB_NAME = "game-backlog";
const DB_VERSION = 1;
const STORE = "documents";

/** False in unit tests and in very old browsers. */
export function hasIndexedDb(): boolean {
  return typeof indexedDB !== "undefined";
}

export function getDocument<T>(key: string): Promise<T | undefined> {
  return request<T | undefined>("readonly", (store) => store.get(key));
}

export async function putDocument(key: string, value: unknown): Promise<void> {
  await request("readwrite", (store) => store.put(value, key));
}

export async function deleteDocument(key: string): Promise<void> {
  await request("readwrite", (store) => store.delete(key));
}

/** The keys that start with `prefix`, sorted. */
export async function listDocumentKeys(prefix: string): Promise<string[]> {
  const keys = await request<IDBValidKey[]>("readonly", (store) => store.getAllKeys(IDBKeyRange.bound(prefix, `${prefix}￿`)));
  return keys.filter((key): key is string => typeof key === "string");
}

/**
 * Ask the browser to keep this origin's data out of storage eviction.
 * Chromium grants it silently once the site is installed or used enough;
 * Firefox asks the user. Resolves true when the data is now persistent.
 */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

/** Whether the data is safe from eviction; null when the browser cannot say. */
export async function isStoragePersisted(): Promise<boolean | null> {
  try {
    if (typeof navigator === "undefined" || !navigator.storage?.persisted) return null;
    return await navigator.storage.persisted();
  } catch {
    return null;
  }
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const opening = indexedDB.open(DB_NAME, DB_VERSION);
    opening.onupgradeneeded = () => {
      if (!opening.result.objectStoreNames.contains(STORE)) opening.result.createObjectStore(STORE);
    };
    opening.onsuccess = () => resolve(opening.result);
    opening.onerror = () => reject(opening.error ?? new Error("The browser database could not be opened"));
    opening.onblocked = () => reject(new Error("The browser database is open in another tab"));
  });
}

async function request<T>(mode: IDBTransactionMode, make: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = make(tx.objectStore(STORE));
    const fail = () => {
      db.close();
      reject(tx.error ?? req.error ?? new Error("The browser database request failed"));
    };
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = fail;
    tx.onabort = fail;
  });
}
