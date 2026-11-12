/**
 * Sync of the web build's plan with the server copy (worker/sync.ts): the
 * key format, the wire protocol's names, and the rule that decides what to
 * do when the local and the server copy differ. Pure; shared with the Worker.
 */
import type { Game, PlaySession } from "./types";

/** What the conflict dialog compares for each copy of the plan. */
export interface PlanSummary {
  /** Games not finished or dropped yet: in progress, paused or not started. */
  inPlan: number;
  finished: number;
  hoursLogged: number;
}

export function summarizePlan(games: readonly Pick<Game, "status">[], sessions: readonly Pick<PlaySession, "hours">[]): PlanSummary {
  let inPlan = 0;
  let finished = 0;
  for (const game of games) {
    if (game.status === "completed") finished++;
    else if (game.status !== "dropped") inPlan++;
  }
  const hoursLogged = Math.round(sessions.reduce((sum, session) => sum + session.hours, 0) * 10) / 10;
  return { inPlan, finished, hoursLogged };
}

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

/** Digits that are not in the alphabet but look like letters that are: 0 is O, 1 is I, 8 is B. */
const LOOKALIKES: Readonly<Record<string, string>> = { "0": "O", "1": "I", "8": "B" };

/** A key in its stored form, cleaned of case, dashes and spaces; null when it is not a key. Strict: the server uses it. */
export function normaliseSyncKey(input: string): string | null {
  const key = input.replace(/[\s-]/g, "").toUpperCase();
  return SYNC_KEY_PATTERN.test(key) ? key : null;
}

/**
 * What a person typed or pasted to join a plan: a key or a whole join link.
 * The digits a key never has are read as the letters they look like, so a
 * key copied by eye still works. Null when it is not a key.
 */
export function readSyncKey(input: string): string | null {
  const typed = (keyInJoinLink(input) ?? input).replace(/[018]/g, (digit) => LOOKALIKES[digit]);
  return normaliseSyncKey(typed);
}

/** The fragment that carries a key in a join link: `…/#join=ABCD-EFGH-…`. */
export const JOIN_FRAGMENT = "join=";

/**
 * A link that opens the app on another device with the key filled in. The key
 * sits in the fragment, which a browser never sends to the server; the app
 * removes it from the address bar as soon as it has read it.
 */
export function joinLink(origin: string, key: string): string {
  return `${origin}/#${JOIN_FRAGMENT}${formatSyncKey(key)}`;
}

/** What follows `join=` in a link or a location hash, as typed; null when there is none. */
export function keyInJoinLink(text: string): string | null {
  const at = text.indexOf(`#${JOIN_FRAGMENT}`);
  if (at < 0) return null;
  const value = text.slice(at + 1 + JOIN_FRAGMENT.length).split(/[&\s]/)[0];
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
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

/**
 * The titles on one copy of the plan and not on the other, compared without case or surrounding spaces, in
 * the order the first copy has them: what choosing the other copy would lose.
 */
export function titlesOnlyIn(these: readonly string[], those: readonly string[]): string[] {
  const key = (title: string) => title.trim().toLowerCase();
  const other = new Set(those.map(key));
  const seen = new Set<string>();
  return these.filter((title) => {
    const k = key(title);
    if (other.has(k) || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
