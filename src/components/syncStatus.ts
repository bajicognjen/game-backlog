import { elapsedSince, formatDateTime } from "../domain/dates";
import { t } from "../i18n/en";
import type { useSync } from "../state/sync";

/**
 * Sync's state as one word with a tone, the same in Settings → Sync and on the top bar's Sync button:
 * green when synced, amber while a change waits for the connection, red when sync stopped or needs a
 * choice, a hollow ring while nothing is settled.
 */
export interface SyncStatus {
  /** The state as a word with a dot (The Dot Not Pill Rule). */
  word: string;
  /** Green when synced, amber while a change waits for the connection, red when sync stopped or needs a choice, a hollow ring while nothing is settled. */
  tone: "ok" | "warn" | "bad" | "quiet";
  /** When the server last confirmed this device's plan, shown as time since. */
  when: string | null;
  /** The time is not the state's own ("Synced 5 min ago") but the last good sync behind a failure ("last synced 5 min ago"). */
  lastSynced: boolean;
  /** What the state means, when there is more to say than the word. */
  detail: string | null;
}

export function statusOf(state: ReturnType<typeof useSync.getState>["state"]): SyncStatus {
  const status = (word: string, tone: SyncStatus["tone"], detail: string | null = null, when: string | null = null, lastSynced = false): SyncStatus => ({
    word,
    tone,
    detail,
    when,
    lastSynced,
  });
  switch (state.kind) {
    case "idle":
      // The last check didn't get through: amber, and the time is when it last did, not "Synced just now".
      if (state.unreachable) return status(t.sync.stateLastSynced, "warn", t.sync.detailUnreachable, state.meta.lastSyncedAt);
      return state.meta.lastSyncedAt ? status(t.sync.stateSynced, "ok", null, state.meta.lastSyncedAt) : status(t.sync.stateOn, "quiet", t.sync.detailNever);
    case "syncing":
      return status(t.sync.stateSyncing, "quiet");
    case "pending": {
      // A failure keeps the time of the last good sync in view, so it's clear how far behind the server may be.
      const last = state.meta.lastSyncedAt;
      if (state.reason === "offline") return status(t.sync.stateWaiting, "warn", t.sync.detailOffline, last, true);
      if (state.reason === "too-large") return status(t.sync.stateStopped, "bad", t.sync.detailTooLarge, last, true);
      return status(t.sync.stateFailed, "bad", t.sync.detailError, last, true);
    }
    case "conflict":
      return status(t.sync.stateConflict, "bad", t.sync.detailConflict);
    case "gone":
      return status(t.sync.stateGone, "bad", t.sync.detailGone);
    default:
      return status("", "quiet");
  }
}

/** The status's time as shown beside its word: "5 min ago", or "last synced 5 min ago" behind a failure. */
export function whenText(status: SyncStatus, now: Date): string | null {
  if (!status.when) return null;
  const since = sinceText(status.when, now);
  return status.lastSynced ? t.sync.lastSyncedSince.replace("{since}", since) : since;
}

/** "just now", "5 min ago", "3 h ago", then the date and time. */
export function sinceText(iso: string, now: Date): string {
  const elapsed = elapsedSince(iso, now);
  if (!elapsed) return formatDateTime(iso);
  if (elapsed.unit === "now") return t.sync.justNow;
  return (elapsed.unit === "min" ? t.sync.minutesAgo : t.sync.hoursAgo).replace("{n}", String(elapsed.n));
}
