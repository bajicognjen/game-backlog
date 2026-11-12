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
  /** What the state means, when there is more to say than the word. */
  detail: string | null;
}

export function statusOf(state: ReturnType<typeof useSync.getState>["state"]): SyncStatus {
  const status = (word: string, tone: SyncStatus["tone"], detail: string | null = null, when: string | null = null): SyncStatus => ({ word, tone, detail, when });
  switch (state.kind) {
    case "idle":
      return state.meta.lastSyncedAt ? status(t.sync.stateSynced, "ok", null, state.meta.lastSyncedAt) : status(t.sync.stateOn, "quiet", t.sync.detailNever);
    case "syncing":
      return status(t.sync.stateSyncing, "quiet");
    case "pending":
      if (state.reason === "offline") return status(t.sync.stateWaiting, "warn", t.sync.detailOffline);
      if (state.reason === "too-large") return status(t.sync.stateStopped, "bad", t.sync.detailTooLarge);
      return status(t.sync.stateFailed, "bad", t.sync.detailError);
    case "conflict":
      return status(t.sync.stateConflict, "bad", t.sync.detailConflict);
    case "gone":
      return status(t.sync.stateGone, "bad", t.sync.detailGone);
    default:
      return status("", "quiet");
  }
}

/** "just now", "5 min ago", "3 h ago", then the date and time. */
export function sinceText(iso: string, now: Date): string {
  const elapsed = elapsedSince(iso, now);
  if (!elapsed) return formatDateTime(iso);
  if (elapsed.unit === "now") return t.sync.justNow;
  return (elapsed.unit === "min" ? t.sync.minutesAgo : t.sync.hoursAgo).replace("{n}", String(elapsed.n));
}
