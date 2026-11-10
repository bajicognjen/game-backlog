/**
 * Sync of the web build's plan with the server copy (worker/sync.ts): the
 * key format, the wire protocol's names, and the rule that decides what to
 * do when the local and the server copy differ. Pure; shared with the Worker.
 */

/** 32 characters of the base32 alphabet, 160 random bits. Case does not matter; dashes and spaces are allowed when typing it. */
export const SYNC_KEY_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
export const SYNC_KEY_LENGTH = 32;
export const SYNC_KEY_PATTERN = /^[A-Z2-7]{32}$/;

export const SYNC_PATH = "/api/sync";
export const SYNC_KEY_HEADER = "X-Sync-Key";
export const BASE_REVISION_HEADER = "X-Sync-Base-Revision";
export const KNOWN_REVISION_HEADER = "X-Sync-Known-Revision";
export const REVISION_HEADER = "X-Sync-Revision";
export const UPDATED_AT_HEADER = "X-Sync-Updated-At";
export const INVITE_HEADER = "X-Invite-Code";

/** The typed or pasted key, cleaned up; null when it is not a key. */
export function normaliseSyncKey(input: string): string | null {
  const key = input.replace(/[\s-]/g, "").toUpperCase();
  return SYNC_KEY_PATTERN.test(key) ? key : null;
}

/** The key in groups of four, easier to read out or compare: ABCD-EFGH-…. */
export function formatSyncKey(key: string): string {
  return key.match(/.{1,4}/g)?.join("-") ?? key;
}

/** Base32 of 20 random bytes: exactly 32 characters, no padding. */
export function syncKeyFromBytes(bytes: Uint8Array): string {
  if (bytes.length !== 20) throw new Error("A sync key is made from 20 bytes");
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += SYNC_KEY_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out;
}

/** What this browser knows about its server copy. */
export interface SyncMeta {
  key: string;
  /** The server revision this browser's data is based on; 0 before the first push. */
  revision: number;
  /** True when a local change has not reached the server yet. */
  dirty: boolean;
  /** When the server last confirmed this browser's data, ISO; null before the first push. */
  lastSyncedAt: string | null;
}

export type SyncPlan = "push" | "pull" | "conflict" | "nothing";

/**
 * What to do when the server's revision is known (null: nothing is stored
 * under the key). Both sides changed means a conflict: a person decides,
 * nothing is merged or overwritten silently.
 */
export function reconcile(meta: Pick<SyncMeta, "revision" | "dirty">, remoteRevision: number | null): SyncPlan {
  if (remoteRevision === null) return "push";
  if (remoteRevision === meta.revision) return meta.dirty ? "push" : "nothing";
  if (remoteRevision > meta.revision) return meta.dirty ? "conflict" : "pull";
  return "conflict"; // the server went backwards: deleted and re-created elsewhere
}
