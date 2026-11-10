/** The sync API against a Map-backed database: identity, revisions, conflicts, limits, the invite code. */
import { describe, expect, it } from "vitest";
import { normaliseSyncKey } from "../src/domain/sync";
import {
  BASE_REVISION_HEADER,
  INVITE_HEADER,
  KNOWN_REVISION_HEADER,
  MAX_DOCUMENT_BYTES,
  REVISION_HEADER,
  SYNC_KEY_HEADER,
  SYNC_PATH,
  UPDATED_AT_HEADER,
  handleSync,
  type SyncDatabase,
  type SyncRow,
} from "./sync";

const ORIGIN = "https://game-backlog.example.workers.dev";
const KEY = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const OTHER_KEY = "234567ABCDEFGHIJKLMNOPQRSTUVWXYZ";

function fakeDb(): SyncDatabase & { rows: Map<string, SyncRow & { createdAt: string }> } {
  const rows = new Map<string, SyncRow & { createdAt: string }>();
  return {
    rows,
    async get(hash) {
      const row = rows.get(hash);
      return row ? { revision: row.revision, document: row.document, updatedAt: row.updatedAt } : null;
    },
    async put(hash, base, document, now) {
      const row = rows.get(hash);
      if (base === 0) {
        if (row) return false;
        rows.set(hash, { revision: 1, document, updatedAt: now, createdAt: now });
        return true;
      }
      if (!row || row.revision !== base) return false;
      rows.set(hash, { ...row, revision: base + 1, document, updatedAt: now });
      return true;
    },
    async delete(hash) {
      rows.delete(hash);
    },
  };
}

const bytes = (text: string) => new TextEncoder().encode(text);
const request = (method: string, headers: Record<string, string>, body?: string | Uint8Array) =>
  new Request(`${ORIGIN}${SYNC_PATH}`, { method, headers: { "Sec-Fetch-Site": "same-origin", ...headers }, body: body as BodyInit | undefined });
const put = (db: SyncDatabase, base: number, text: string, headers: Record<string, string> = {}, options = {}) =>
  handleSync(request("PUT", { [SYNC_KEY_HEADER]: KEY, [BASE_REVISION_HEADER]: String(base), ...headers }, bytes(text)), db, options);
const get = (db: SyncDatabase, key = KEY) => handleSync(request("GET", { [SYNC_KEY_HEADER]: key }), db);

describe("handleSync", () => {
  it("serves only pages of its own origin", async () => {
    const response = await handleSync(new Request(`${ORIGIN}${SYNC_PATH}`, { headers: { [SYNC_KEY_HEADER]: KEY } }), fakeDb());
    expect(response.status).toBe(403);
  });

  it("insists on a well-formed key and ignores its case", async () => {
    const db = fakeDb();
    expect((await handleSync(request("GET", {}), db)).status).toBe(400);
    expect((await handleSync(request("GET", { [SYNC_KEY_HEADER]: "too-short" }), db)).status).toBe(400);
    expect(normaliseSyncKey(` ${KEY.toLowerCase()} `)).toBe(KEY);
    expect(normaliseSyncKey("ABCDEFGHIJKLMNOPQRSTUVWXYZ234561")).toBeNull(); // 1 is not in the alphabet
  });

  it("stores a first document as revision 1 and serves it back with its revision", async () => {
    const db = fakeDb();
    const now = () => new Date("2026-11-10T12:00:00.000Z");
    const created = await put(db, 0, '{"games":[]}', {}, { now });
    expect(created.status).toBe(200);
    expect(await created.json()).toEqual({ revision: 1, updatedAt: "2026-11-10T12:00:00.000Z" });

    const fetched = await get(db);
    expect(fetched.status).toBe(200);
    expect(fetched.headers.get(REVISION_HEADER)).toBe("1");
    expect(fetched.headers.get(UPDATED_AT_HEADER)).toBe("2026-11-10T12:00:00.000Z");
    expect(fetched.headers.get("cache-control")).toBe("no-store");
    expect(await fetched.text()).toBe('{"games":[]}');

    expect((await get(db, OTHER_KEY)).status).toBe(404);

    // A check that already knows the current revision gets no body.
    const known = await handleSync(request("GET", { [SYNC_KEY_HEADER]: KEY, [KNOWN_REVISION_HEADER]: "1" }), db);
    expect(known.status).toBe(304);
    expect(known.headers.get(REVISION_HEADER)).toBe("1");
    expect((await handleSync(request("GET", { [SYNC_KEY_HEADER]: KEY, [KNOWN_REVISION_HEADER]: "0" }), db)).status).toBe(200);
    expect([...db.rows.keys()]).not.toContain(KEY); // stored hashed, never the key itself
  });

  it("accepts a write based on the current revision and refuses a stale one with the current document", async () => {
    const db = fakeDb();
    await put(db, 0, "v1");
    expect((await put(db, 1, "v2")).status).toBe(200);

    const stale = await put(db, 1, "v2-from-another-device");
    expect(stale.status).toBe(409);
    expect(stale.headers.get(REVISION_HEADER)).toBe("2");
    expect(await stale.text()).toBe("v2");

    const creatingAgain = await put(db, 0, "fresh device");
    expect(creatingAgain.status).toBe(409);
    expect(await get(db).then((r) => r.text())).toBe("v2");
  });

  it("rejects an empty, oversized or unnumbered document", async () => {
    const db = fakeDb();
    expect((await put(db, 0, "")).status).toBe(400);
    expect((await handleSync(request("PUT", { [SYNC_KEY_HEADER]: KEY }, bytes("x")), db)).status).toBe(400);
    expect((await put(db, 0, "x", { [BASE_REVISION_HEADER]: "later" })).status).toBe(400);
    expect((await put(db, 0, "x".repeat(MAX_DOCUMENT_BYTES + 1))).status).toBe(413);
    expect(db.rows.size).toBe(0);
  });

  it("asks new keys for the invite code when one is configured, and existing keys never", async () => {
    const db = fakeDb();
    const options = { inviteCode: "friends-only" };
    expect((await put(db, 0, "v1", {}, options)).status).toBe(403);
    expect((await put(db, 0, "v1", { [INVITE_HEADER]: "wrong" }, options)).status).toBe(403);
    expect((await put(db, 0, "v1", { [INVITE_HEADER]: "friends-only" }, options)).status).toBe(200);
    expect((await put(db, 1, "v2", {}, options)).status).toBe(200);
    expect((await put(db, 0, "v1", {}, { inviteCode: "" })).status).toBe(409); // no code required, but the key exists
  });

  it("deletes the server copy", async () => {
    const db = fakeDb();
    await put(db, 0, "v1");
    expect((await handleSync(request("DELETE", { [SYNC_KEY_HEADER]: KEY }), db)).status).toBe(204);
    expect((await get(db)).status).toBe(404);
    expect((await handleSync(request("POST", { [SYNC_KEY_HEADER]: KEY }), db)).status).toBe(405);
  });
});
