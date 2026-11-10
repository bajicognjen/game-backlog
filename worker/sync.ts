/**
 * The server copy of a synced plan. The browser keeps its IndexedDB copy and
 * mirrors every change here (`src/platform/sync.ts`); another browser with
 * the same sync key pulls it. The key is a random code the browser made; it
 * is the only identity, travels in a header, and is stored hashed. The
 * document is opaque bytes (the JSON backup document, gzip-compressed by the
 * browser), so the Worker spends no CPU on it and never sees secrets, which
 * the browser leaves out anyway.
 *
 *   GET    /api/sync   -> 200 bytes + X-Sync-Revision / X-Sync-Updated-At, or 404;
 *                         304 when X-Sync-Known-Revision is the current one
 *   PUT    /api/sync   -> 200 { revision, updatedAt }; 409 with the current
 *                         document when X-Sync-Base-Revision is stale; 413 too big;
 *                         403 when a new key needs the invite code
 *   DELETE /api/sync   -> 204
 *
 * Like the proxy, it serves only pages of this origin.
 */
import {
  BASE_REVISION_HEADER,
  INVITE_HEADER,
  KNOWN_REVISION_HEADER,
  REVISION_HEADER,
  SYNC_KEY_HEADER,
  SYNC_PATH,
  UPDATED_AT_HEADER,
  normaliseSyncKey,
} from "../src/domain/sync";
import { isSameOrigin } from "./proxy";

export { BASE_REVISION_HEADER, INVITE_HEADER, KNOWN_REVISION_HEADER, REVISION_HEADER, SYNC_KEY_HEADER, SYNC_PATH, UPDATED_AT_HEADER };
/** Largest document stored, in bytes as sent (compressed). D1 rows take a little under 2 MB; keep headroom. */
export const MAX_DOCUMENT_BYTES = 1_000_000;

export interface SyncRow {
  revision: number;
  document: Uint8Array;
  updatedAt: string;
}

/** What the handler needs from storage; `worker/index.ts` backs it with D1, the tests with a Map. */
export interface SyncDatabase {
  get(keyHash: string): Promise<SyncRow | null>;
  /**
   * Store `document` as revision `baseRevision + 1`: an insert when `baseRevision`
   * is 0 and nothing is stored yet, an update when the stored revision equals
   * `baseRevision`. Resolves false when neither holds (a stale write).
   */
  put(keyHash: string, baseRevision: number, document: Uint8Array, now: string): Promise<boolean>;
  delete(keyHash: string): Promise<void>;
}

export interface SyncOptions {
  /** When set, creating a document under a new key requires this code in `X-Invite-Code`. */
  inviteCode?: string | null;
  now?: () => Date;
}

export async function handleSync(request: Request, db: SyncDatabase, options: SyncOptions = {}): Promise<Response> {
  if (!isSameOrigin(request)) return problem(403, "The sync API only serves the app on this origin.");
  const key = normaliseSyncKey(request.headers.get(SYNC_KEY_HEADER) ?? "");
  if (!key) return problem(400, "Missing or malformed sync key.");
  const keyHash = await sha256Hex(key);

  switch (request.method) {
    case "GET": {
      const row = await db.get(keyHash);
      if (!row) return problem(404, "Nothing is synced under this key yet.");
      const known = request.headers.get(KNOWN_REVISION_HEADER);
      if (known !== null && Number(known) === row.revision) {
        return new Response(null, { status: 304, headers: { "Cache-Control": "no-store", [REVISION_HEADER]: String(row.revision), [UPDATED_AT_HEADER]: row.updatedAt } });
      }
      return documentResponse(200, row);
    }
    case "PUT": {
      const baseHeader = request.headers.get(BASE_REVISION_HEADER)?.trim() ?? "";
      const base = baseHeader === "" ? NaN : Number(baseHeader);
      if (!Number.isInteger(base) || base < 0) return problem(400, "Missing or malformed base revision.");
      const declared = Number(request.headers.get("Content-Length"));
      if (declared > MAX_DOCUMENT_BYTES) return problem(413, `The document is too large (limit ${MAX_DOCUMENT_BYTES} bytes).`);
      const document = new Uint8Array(await request.arrayBuffer());
      if (document.byteLength === 0) return problem(400, "Empty document.");
      if (document.byteLength > MAX_DOCUMENT_BYTES) return problem(413, `The document is too large (limit ${MAX_DOCUMENT_BYTES} bytes).`);

      const invite = options.inviteCode?.trim() ?? "";
      if (base === 0 && invite !== "" && (await db.get(keyHash)) === null && request.headers.get(INVITE_HEADER)?.trim() !== invite) {
        return problem(403, "A new sync key needs the invite code.");
      }

      const now = (options.now ?? (() => new Date()))().toISOString();
      if (await db.put(keyHash, base, document, now)) return json(200, { revision: base + 1, updatedAt: now });
      const current = await db.get(keyHash);
      return current ? documentResponse(409, current) : problem(409, "The document changed; load it again.");
    }
    case "DELETE": {
      await db.delete(keyHash);
      return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
    }
    default:
      return problem(405, "Only GET, PUT and DELETE are supported.");
  }
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function documentResponse(status: number, row: SyncRow): Response {
  return new Response(row.document, {
    status,
    headers: {
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store",
      [REVISION_HEADER]: String(row.revision),
      [UPDATED_AT_HEADER]: row.updatedAt,
    },
  });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

function problem(status: number, message: string): Response {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
