import { create } from "zustand";
import {
  repository,
  type CompletedDetails,
  type FinishInput,
  type GameInput,
  type GamePatch,
  type PlanOrder,
} from "../db";
import { backupFileName, createBackup, parseBackup, serializeBackup, type Backup } from "../domain/backup";
import { completedIds, insertAt, moveItem, plannedIds, withCompletedOrder, withPlanOrder } from "../domain/plan";
import { SEED_SETTINGS } from "../domain/seed";
import type { Game, GameStatus, Platform, Settings } from "../domain/types";
import { openTextFile, saveTextFile } from "../platform/files";

export type LoadStatus = "loading" | "ready" | "error";

export interface AppState {
  status: LoadStatus;
  /** Last failed operation, shown in a banner until dismissed. */
  error: string | null;
  /** Last success message worth showing (export, import), until dismissed. */
  notice: string | null;
  games: Game[];
  settings: Settings;

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
  /** Finish a planned game: completed today (or the given date), next game on that platform starts. */
  finishGame(id: number, input: FinishInput): Promise<boolean>;
  /** Add a game that was finished before the app existed. */
  addCompletedGame(input: GameInput & CompletedDetails): Promise<boolean>;
  /** Set or change the rating and review of a completed game. */
  rateGame(id: number, rating: number | null, review: string | null): Promise<boolean>;
  /** Start, pause or resume a planned game. */
  setGameStatus(id: number, status: Exclude<GameStatus, "completed">): Promise<boolean>;
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
  dismissError(): void;
  dismissNotice(): void;
}

/** Messages the store needs; injected so the store stays free of UI strings. */
export interface StoreMessages {
  exported: string;
  imported: string;
  invalidBackup(path: string, reason: string): string;
}

let messages: StoreMessages = {
  exported: "Backup saved.",
  imported: "Backup imported.",
  invalidBackup: (path, reason) => `Invalid backup (${path}: ${reason}).`,
};

export function setStoreMessages(next: StoreMessages): void {
  messages = next;
}

export const useStore = create<AppState>((set, get) => {
  /** Re-read everything from storage after a write. */
  async function reload(): Promise<void> {
    const { games, settings } = await repository.load();
    set({ games, settings });
  }

  /** Run a write, then reload; report failures in the banner. */
  async function persist(write: () => Promise<void>): Promise<boolean> {
    try {
      await write();
      await reload();
      return true;
    } catch (error) {
      set({ error: describeError(error) });
      return false;
    }
  }

  /** The current plan order of one platform, minus `exceptId`. */
  function orderWithout(platform: Platform, exceptId: number): PlanOrder {
    return { platform, ids: plannedIds(get().games, platform).filter((id) => id !== exceptId) };
  }

  return {
    status: "loading",
    error: null,
    notice: null,
    games: [],
    settings: SEED_SETTINGS,

    async load() {
      try {
        const { games, settings } = await repository.load();
        set({ status: "ready", games, settings, error: null });
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

    removeGame(id) {
      const game = get().games.find((g) => g.id === id);
      if (!game) return Promise.resolve(false);
      return persist(() => repository.deleteGame(id, orderWithout(game.platform, id)));
    },

    finishGame(id, input) {
      const game = get().games.find((g) => g.id === id);
      if (!game) return Promise.resolve(false);
      return persist(() => repository.finishGame(id, input, orderWithout(game.platform, id)));
    },

    addCompletedGame(input) {
      return persist(() => repository.addCompletedGame(input));
    },

    rateGame(id, rating, review) {
      return persist(() => repository.updateGame(id, { rating, review }));
    },

    setGameStatus(id, status) {
      return persist(() => repository.updateGame(id, { status }));
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
      const { games, settings } = get();
      try {
        const saved = await saveTextFile(backupFileName(), serializeBackup(createBackup(games, settings)));
        if (saved) set({ notice: messages.exported, error: null });
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
      if (ok) set({ notice: messages.imported });
      return ok;
    },

    dismissError() {
      set({ error: null });
    },

    dismissNotice() {
      set({ notice: null });
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
