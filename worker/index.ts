/**
 * The Cloudflare Worker behind the web version: static assets from `dist/`
 * (configured in `wrangler.jsonc`, served before this code runs for every
 * path but `/api/*`), the API proxy, and the sync store backed by D1.
 */
import { PROXY_PATH } from "../src/platform/proxy";
import { handleProxy } from "./proxy";
import { SYNC_PATH, handleSync, type SyncDatabase, type SyncRow } from "./sync";

interface Env {
  ASSETS: Fetcher;
  SYNC_DB: D1Database;
  /** Optional secret: when set, a new sync key must present it (see worker/sync.ts). */
  SYNC_INVITE_CODE?: string;
}

export default {
  fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === PROXY_PATH) return handleProxy(request);
    if (pathname === SYNC_PATH) return handleSync(request, d1Database(env.SYNC_DB), { inviteCode: env.SYNC_INVITE_CODE ?? null });
    return env.ASSETS.fetch(request);
  },
} satisfies ExportedHandler<Env>;

/** The sync store on D1 (schema in worker/migrations). A conditional UPDATE/INSERT makes stale writes fail without a transaction. */
function d1Database(db: D1Database): SyncDatabase {
  return {
    async get(keyHash): Promise<SyncRow | null> {
      const row = await db
        .prepare("SELECT revision, document, updated_at FROM sync_documents WHERE key_hash = ?")
        .bind(keyHash)
        .first<{ revision: number; document: ArrayBuffer; updated_at: string }>();
      return row ? { revision: row.revision, document: new Uint8Array(row.document), updatedAt: row.updated_at } : null;
    },
    async put(keyHash, baseRevision, document, now) {
      const result =
        baseRevision === 0
          ? await db
              .prepare(
                "INSERT INTO sync_documents (key_hash, revision, document, bytes, created_at, updated_at) VALUES (?, 1, ?, ?, ?, ?) ON CONFLICT(key_hash) DO NOTHING",
              )
              .bind(keyHash, document, document.byteLength, now, now)
              .run()
          : await db
              .prepare("UPDATE sync_documents SET revision = revision + 1, document = ?, bytes = ?, updated_at = ? WHERE key_hash = ? AND revision = ?")
              .bind(document, document.byteLength, now, keyHash, baseRevision)
              .run();
      return result.meta.changes === 1;
    },
    async delete(keyHash) {
      await db.prepare("DELETE FROM sync_documents WHERE key_hash = ?").bind(keyHash).run();
    },
  };
}
