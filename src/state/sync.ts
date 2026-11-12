/**
 * The sync engine for the UI (web build only). Owns one engine, mirrors
 * its state into this store, and reloads the plan after a pull.
 */
import { isTauri } from "@tauri-apps/api/core";
import { create } from "zustand";
import { repository } from "../db";
import { STATE_KEY, onWebStateSaved, type StoredState } from "../db/webRepository";
import { getDocument, hasIndexedDb } from "../db/webStorage";
import type { Backup } from "../domain/backup";
import { readSyncKey } from "../domain/sync";
import { t } from "../i18n/en";
import {
  createSyncApi,
  createSyncEngine,
  describeConflict,
  type ConflictChoice,
  type ConflictSides,
  type ConnectResult,
  type SyncEngine,
  type SyncState,
} from "../platform/sync";
import { describeError, useStore } from "./store";

export interface SyncUiState {
  /** False in the desktop app and in unit tests: the section is not shown. */
  supported: boolean;
  state: SyncState;
  /** The last explicit action that failed outright (a network error on connect or delete). */
  actionError: string | null;
  start(): Promise<void>;
  enable(inviteCode?: string): Promise<void>;
  /** `invalid`: the input is not a key; `not-found`: nothing is stored under it; `failed`: see `actionError`. */
  connect(input: string): Promise<"invalid" | ConnectResult | "failed">;
  disable(): Promise<void>;
  deleteServerCopy(): Promise<void>;
  resolve(choice: ConflictChoice): Promise<void>;
  /** The two copies in a conflict, summed up for the dialog; null outside a conflict or when the server copy can't be read. */
  conflictSides(): Promise<ConflictSides | null>;
  check(): Promise<void>;
}

let engine: SyncEngine | null = null;

function getEngine(): SyncEngine {
  if (!engine) {
    engine = createSyncEngine({
      repository,
      api: createSyncApi(),
      onChange: (state) => useSync.setState({ state }),
      onPulled: async () => {
        await useStore.getState().load();
        useStore.getState().notify(t.sync.pulled);
      },
    });
    const current = engine;
    onWebStateSaved((state) => current.noteSaved(state));
  }
  return engine;
}

export const useSync = create<SyncUiState>((set, get) => {
  /** Run an action; a failure thrown by the engine (network trouble on connect or delete) lands in `actionError`. */
  async function attempt(action: (engine: SyncEngine) => Promise<void>): Promise<void> {
    set({ actionError: null });
    try {
      await action(getEngine());
    } catch (error) {
      set({ actionError: describeError(error) });
    }
  }

  return {
    supported: !isTauri() && hasIndexedDb(),
    state: { kind: "off" },
    actionError: null,
    start: () => attempt((e) => e.start()),
    enable: (inviteCode) => attempt((e) => e.enable(inviteCode ?? null)),
    async connect(input) {
      if (!readSyncKey(input)) return "invalid";
      let result: ConnectResult | "failed" = "failed";
      await attempt(async (e) => {
        result = await e.connect(input);
      });
      return result;
    },
    disable: () => attempt((e) => e.disable()),
    deleteServerCopy: () => attempt((e) => e.deleteServerCopy()),
    async resolve(choice) {
      const outcome: { replaced: Backup | null } = { replaced: null };
      await attempt(async (e) => {
        outcome.replaced = await e.resolve(choice);
      });
      const replaced = outcome.replaced;
      if (!replaced) return;
      // The Second Chance Rule: for 20 seconds the replaced plan can come back. Applying it is a
      // local save, so sync sends it to the server too: undo ends with both sides on the other plan.
      const keptMine = choice === "keep-mine";
      useStore.getState().offerUndo(keptMine ? t.sync.keptMine : t.sync.tookServer, async () => {
        if (await useStore.getState().applyBackup(replaced)) useStore.getState().notify(keptMine ? t.sync.undoKeptMine : t.sync.undoTookServer);
      });
    },
    async conflictSides() {
      const current = get().state;
      if (current.kind !== "conflict") return null;
      try {
        return await describeConflict(await getDocument<StoredState>(STATE_KEY), current.remote);
      } catch {
        return null; // an unreadable server copy: the dialog still offers the choice, without the numbers
      }
    },
    check: () => attempt((e) => e.check()),
  };
});
