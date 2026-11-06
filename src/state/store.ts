import { create } from "zustand";
import {
  repository,
  type CompletedDetails,
  type FinishInput,
  type GameInput,
  type GamePatch,
  type PlanOrder,
  type SessionInput,
} from "../db";
import { backupFileName, createBackup, parseBackup, serializeBackup, type Backup } from "../domain/backup";
import { completedIds, insertAt, moveItem, plannedIds, withCompletedOrder, withPlanOrder } from "../domain/plan";
import { isDone } from "../domain/types";
import { sessionsOf } from "../domain/sessions";
import { SEED_SETTINGS } from "../domain/seed";
import type { Game, Platform, PlaySession, Settings } from "../domain/types";
import { todayIso } from "../domain/dates";
import { writeAutoBackup } from "../platform/autoBackup";
import { openTextFile, saveTextFile } from "../platform/files";

export type LoadStatus = "loading" | "ready" | "error";

export interface AppState {
  status: LoadStatus;
  /** Last failed operation, shown in a banner until dismissed. */
  error: string | null;
  /** Last success message worth showing (export, import, delete), until dismissed. */
  notice: string | null;
  /** When set, the notice offers to undo the last delete, drop or finish. */
  undo: (() => Promise<void>) | null;
  /** True while the pointer or keyboard is on the undo offer; the countdown waits. */
  undoHeld: boolean;
  games: Game[];
  settings: Settings;
  /** All logged sessions; each game's `hoursPlayed` is their sum. */
  sessions: PlaySession[];
  /** The game finished moments ago, while its undo offer stands; the finished list marks its row. */
  recentlyFinishedId: number | null;

  load(): Promise<void>;
  updateSettings(patch: Partial<Settings>): Promise<void>;
  /** Add a planned game at the 0-based `index` of its platform's plan. Resolves true on success. */
  addGame(input: GameInput, index: number): Promise<boolean>;
  /**
   * Edit a game's fields. When `index` is given the game moves to that slot;
   * a platform change moves it between plans (to `index`, or to the end).
   */
  editGame(id: number, patch: GamePatch, index?: number): Promise<boolean>;
  removeGame(id: number): Promise<boolean>;
  /** Write several game patches (e.g. refreshed IGDB metadata) with one reload, then show `notice`. */
  updateGames(updates: readonly GameUpdate[], notice: string): Promise<boolean>;
  /** Finish a planned game: completed today (or the given date), next game on that platform starts. */
  finishGame(id: number, input: FinishInput): Promise<boolean>;
  /** Add a game that was finished before the app existed. */
  addCompletedGame(input: GameInput & CompletedDetails): Promise<boolean>;
  /** Set or change the rating and review of a completed game. */
  rateGame(id: number, rating: number | null, review: string | null): Promise<boolean>;
  /** Start, pause or resume a planned game. */
  setGameStatus(id: number, status: "in_progress" | "pending" | "paused"): Promise<boolean>;
  /** Give up on a planned game: it moves to the finished list as dropped, dated today. */
  dropGame(id: number): Promise<boolean>;
  /** Log hours played on a game. */
  logSession(input: SessionInput): Promise<boolean>;
  removeSession(id: number): Promise<boolean>;
  /** Drag-and-drop within one platform: put `activeId` where `overId` currently is. */
  moveGame(activeId: number, overId: number): Promise<void>;
  /** Drag-and-drop in the completed list: put `activeId` where `overId` currently is (finish order). */
  moveCompleted(activeId: number, overId: number): Promise<void>;
  /** Write all data to a JSON file the user picks. */
  exportBackup(): Promise<void>;
  /** Let the user pick a backup file and validate it; null when cancelled or invalid. */
  pickBackup(): Promise<{ name: string; backup: Backup } | null>;
  /** Replace everything with a validated backup. */
  applyBackup(backup: Backup): Promise<boolean>;
  /** Run the pending undo, if any. */
  undoLast(): Promise<void>;
  /** Stop the undo countdown while the user is on the offer; `resumeUndo` restarts it with the time left. */
  pauseUndo(): void;
  resumeUndo(): void;
  dismissError(): void;
  dismissNotice(): void;
}

/** How long an undo offer stays on screen (a thin line under it drains over this time). */
export const UNDO_WINDOW_MS = 20000;
/** How long a routine confirmation (restored, exported, imported) stays before it clears itself. */
export const NOTICE_WINDOW_MS = 8000;

/** Messages the store needs; injected so the store stays free of UI strings. */
export interface StoreMessages {
  exported: string;
  imported: string;
  invalidBackup(path: string, reason: string): string;
  autoBackupFailed(detail: string): string;
  deleted(title: string): string;
  dropped(title: string): string;
  restored(title: string): string;
  /** A game was finished; `next` is the title that was put in progress, if any. */
  finished(title: string, rating: number | null, next: string | null): string;
}

export interface GameUpdate {
  id: number;
  patch: GamePatch;
}

let messages: StoreMessages = {
  exported: "Backup saved.",
  imported: "Backup imported.",
  invalidBackup: (path, reason) => `Invalid backup (${path}: ${reason}).`,
  autoBackupFailed: (detail) => `Automatic backup failed: ${detail}`,
  deleted: (title) => `Deleted "${title}".`,
  dropped: (title) => `Dropped "${title}".`,
  restored: (title) => `Restored "${title}".`,
  finished: (title, rating, next) =>
    `Finished "${title}"${rating === null ? "" : `, rated ${rating}/10`}.${next ? ` "${next}" is now in progress.` : ""}`,
};

/** How long after the last change the automatic backup is written. */
export const AUTO_BACKUP_DELAY_MS = 2000;

export function setStoreMessages(next: StoreMessages): void {
  messages = next;
}

export const useStore = create<AppState>((set, get) => {
  /** Re-read everything from storage after a write. */
  async function reload(): Promise<void> {
    const { games, settings, sessions } = await repository.load();
    set({ games, settings, sessions });
  }

  /** Run a write, then reload; report failures in the banner. */
  async function persist(write: () => Promise<void>): Promise<boolean> {
    try {
      await write();
      await reload();
      scheduleAutoBackup();
      return true;
    } catch (error) {
      set({ error: describeError(error) });
      return false;
    }
  }

  let undoTimer: ReturnType<typeof setTimeout> | null = null;
  let undoRemainingMs = 0;
  let noticeTimer: ReturnType<typeof setTimeout> | null = null;

  function clearTimers(): void {
    if (undoTimer) clearTimeout(undoTimer);
    if (noticeTimer) clearTimeout(noticeTimer);
    undoTimer = null;
    noticeTimer = null;
  }

  let undoDeadlineMs = 0;
  const undoDeadline = () => undoDeadlineMs;

  /** Let the current undo offer expire after `ms`. */
  function armUndo(undo: () => Promise<void>, ms: number): void {
    undoDeadlineMs = Date.now() + ms;
    undoTimer = setTimeout(() => {
      undoTimer = null;
      if (get().undo === undo) set({ notice: null, undo: null, undoHeld: false, recentlyFinishedId: null });
    }, ms);
  }

  /** Show a notice with an undo button; it expires unless the user is on it. */
  function offerUndo(notice: string, undo: () => Promise<void>): void {
    clearTimers();
    set({ notice, undo, undoHeld: false, error: null });
    armUndo(undo, UNDO_WINDOW_MS);
  }

  /** Show a routine confirmation that clears itself. */
  function flashNotice(notice: string): void {
    clearTimers();
    set({ notice, undo: null, undoHeld: false });
    noticeTimer = setTimeout(() => {
      noticeTimer = null;
      if (get().notice === notice) set({ notice: null });
    }, NOTICE_WINDOW_MS);
  }

  let autoBackupTimer: ReturnType<typeof setTimeout> | null = null;
  let autoBackupWarned = false;

  /** Write the automatic backup a moment after the last change, so bursts of edits produce one file. */
  function scheduleAutoBackup(): void {
    if (autoBackupTimer) clearTimeout(autoBackupTimer);
    autoBackupTimer = setTimeout(async () => {
      autoBackupTimer = null;
      const { games, settings, sessions } = get();
      try {
        await writeAutoBackup(serializeBackup(createBackup(games, settings, sessions)));
      } catch (error) {
        if (autoBackupWarned) return; // one warning per session is enough
        autoBackupWarned = true;
        set({ error: messages.autoBackupFailed(describeError(error)) });
      }
    }, AUTO_BACKUP_DELAY_MS);
  }

  /** The current plan order of one platform, minus `exceptId`. */
  function orderWithout(platform: Platform, exceptId: number): PlanOrder {
    return { platform, ids: plannedIds(get().games, platform).filter((id) => id !== exceptId) };
  }

  return {
    status: "loading",
    error: null,
    notice: null,
    undo: null,
    undoHeld: false,
    games: [],
    settings: SEED_SETTINGS,
    sessions: [],
    recentlyFinishedId: null,

    async load() {
      try {
        const { games, settings, sessions } = await repository.load();
        set({ status: "ready", games, settings, sessions, error: null });
      } catch (error) {
        set({ status: "error", error: describeError(error) });
      }
    },

    async updateSettings(patch) {
      const previous = get().settings;
      // Optimistic: the plan recalculates immediately, storage catches up.
      set({ settings: { ...previous, ...patch } });
      try {
        await repository.saveSettings(patch);
        scheduleAutoBackup();
      } catch (error) {
        set({ settings: previous, error: describeError(error) });
      }
    },

    addGame(input, index) {
      const ids = insertAt<number | "new">(plannedIds(get().games, input.platform), "new", index);
      return persist(() => repository.addPlannedGame(input, { platform: input.platform, ids }));
    },

    editGame(id, patch, index) {
      return persist(async () => {
        const game = get().games.find((g) => g.id === id);
        if (!game) throw new Error(`Game ${id} not found`);
        await repository.updateGame(id, patch);
        if (game.status === "completed") return;

        const from = game.platform;
        const to = patch.platform ?? from;
        if (to !== from) {
          await repository.setPlanOrder(orderWithout(from, id));
          const target = plannedIds(get().games, to);
          await repository.setPlanOrder({ platform: to, ids: insertAt(target, id, index ?? target.length) });
          return;
        }
        if (index === undefined) return;
        const ids = plannedIds(get().games, from);
        const current = ids.indexOf(id);
        if (current < 0 || current === index) return;
        await repository.setPlanOrder({ platform: from, ids: moveItem(ids, current, index) });
      });
    },

    async removeGame(id) {
      const { games, sessions } = get();
      const game = games.find((g) => g.id === id);
      if (!game) return false;
      // Remember enough to put it back exactly where it was.
      const planOrder = isDone(game) ? null : { platform: game.platform, ids: plannedIds(games, game.platform) };
      const completedOrder = isDone(game) ? completedIds(games) : null;
      const ownSessions = sessionsOf(sessions, id);
      const ok = await persist(() => repository.deleteGame(id, orderWithout(game.platform, id)));
      if (ok) {
        offerUndo(messages.deleted(game.title), async () => {
          if (await persist(() => repository.reinsertGame(game, ownSessions, planOrder, completedOrder))) {
            flashNotice(messages.restored(game.title));
          }
        });
      }
      return ok;
    },

    async updateGames(updates, notice) {
      const ok = await persist(async () => {
        for (const { id, patch } of updates) await repository.updateGame(id, patch);
      });
      if (ok) set({ notice, undo: null, error: null });
      return ok;
    },

    async finishGame(id, input) {
      const { games, settings } = get();
      const game = games.find((g) => g.id === id);
      if (!game) return false;
      // Remember enough to put the plan back: the full orders, the next game's status and the start date.
      const planOrder = { platform: game.platform, ids: plannedIds(games, game.platform) };
      const completedOrder = completedIds(games);
      const remaining = planOrder.ids.filter((other) => other !== id);
      const next = remaining.length > 0 ? games.find((g) => g.id === remaining[0]) : undefined;
      const startsNext = input.startNext && next !== undefined && next.status !== "completed";
      const previousStartDate = settings.startDate;
      const ok = await persist(() => repository.finishGame(id, input, { platform: game.platform, ids: remaining }));
      if (ok) {
        set({ recentlyFinishedId: id });
        offerUndo(messages.finished(game.title, input.rating, startsNext && next ? next.title : null), async () => {
          const restored = await persist(async () => {
            await repository.restoreGame(game, planOrder, completedOrder);
            if (startsNext && next) await repository.updateGame(next.id, { status: next.status });
            if (input.nextStartDate) await repository.saveSettings({ startDate: previousStartDate });
          });
          if (restored) {
            set({ recentlyFinishedId: null });
            flashNotice(messages.restored(game.title));
          }
        });
      }
      return ok;
    },

    addCompletedGame(input) {
      return persist(() => repository.addCompletedGame(input));
    },

    logSession(input) {
      return persist(() => repository.addSession(input));
    },

    removeSession(id) {
      return persist(() => repository.deleteSession(id));
    },

    rateGame(id, rating, review) {
      return persist(() => repository.updateGame(id, { rating, review }));
    },

    setGameStatus(id, status) {
      return persist(() => repository.updateGame(id, { status }));
    },

    async dropGame(id) {
      const { games } = get();
      const game = games.find((g) => g.id === id);
      if (!game) return false;
      const planOrder = { platform: game.platform, ids: plannedIds(games, game.platform) };
      const completedOrder = completedIds(games);
      const ok = await persist(() => repository.dropGame(id, todayIso(), orderWithout(game.platform, id)));
      if (ok) {
        offerUndo(messages.dropped(game.title), async () => {
          if (await persist(() => repository.restoreGame(game, planOrder, completedOrder))) {
            flashNotice(messages.restored(game.title));
          }
        });
      }
      return ok;
    },

    async moveGame(activeId, overId) {
      const { games } = get();
      const active = games.find((g) => g.id === activeId);
      if (!active) return;
      const ids = plannedIds(games, active.platform);
      const from = ids.indexOf(activeId);
      const to = ids.indexOf(overId);
      if (from < 0 || to < 0 || from === to) return;
      const order = moveItem(ids, from, to);
      // Optimistic: the table (and dates) move at once; storage catches up.
      set({ games: withPlanOrder(games, order, active.platform) });
      try {
        await repository.setPlanOrder({ platform: active.platform, ids: order });
      } catch (error) {
        set({ games, error: describeError(error) });
      }
    },

    async moveCompleted(activeId, overId) {
      const { games } = get();
      const ids = completedIds(games);
      const from = ids.indexOf(activeId);
      const to = ids.indexOf(overId);
      if (from < 0 || to < 0 || from === to) return;
      const order = moveItem(ids, from, to);
      set({ games: withCompletedOrder(games, order) });
      try {
        await repository.setCompletedOrder(order);
      } catch (error) {
        set({ games, error: describeError(error) });
      }
    },

    async exportBackup() {
      const { games, settings, sessions } = get();
      try {
        const saved = await saveTextFile(backupFileName(), serializeBackup(createBackup(games, settings, sessions)));
        if (saved) {
          set({ error: null });
          flashNotice(messages.exported);
        }
      } catch (error) {
        set({ error: describeError(error) });
      }
    },

    async pickBackup() {
      try {
        const file = await openTextFile();
        if (!file) return null;
        return { name: file.name, backup: parseBackup(file.text) };
      } catch (error) {
        set({ error: isBackupError(error) ? messages.invalidBackup(error.path, error.reason) : describeError(error) });
        return null;
      }
    },

    async applyBackup(backup) {
      const ok = await persist(() => repository.replaceAll(backup));
      if (ok) flashNotice(messages.imported);
      return ok;
    },

    async undoLast() {
      const undo = get().undo;
      if (!undo) return;
      clearTimers();
      set({ undo: null, undoHeld: false });
      await undo();
    },

    pauseUndo() {
      const { undo, undoHeld } = get();
      if (!undo || undoHeld || !undoTimer) return;
      // Keep what is left of the window; `resumeUndo` arms it again.
      undoRemainingMs = Math.max(1000, undoDeadline() - Date.now());
      clearTimeout(undoTimer);
      undoTimer = null;
      set({ undoHeld: true });
    },

    resumeUndo() {
      const { undo, undoHeld } = get();
      if (!undo || !undoHeld) return;
      set({ undoHeld: false });
      armUndo(undo, undoRemainingMs);
    },

    dismissError() {
      set({ error: null });
    },

    dismissNotice() {
      clearTimers();
      set({ notice: null, undo: null, undoHeld: false, recentlyFinishedId: null });
    },
  };
});

function isBackupError(error: unknown): error is { path: string; reason: string } {
  return error instanceof Error && error.name === "BackupError";
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
