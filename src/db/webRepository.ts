import { BACKUP_VERSION, parseBackup, type Backup } from "../domain/backup";
import { parseHiddenApps } from "../domain/steam";
import { parseDismissedHints } from "../domain/steamHints";
import type { Settings } from "../domain/types";
import type { Repository } from "./repository";
import { createSnapshotRepository, emptyState, nextIdAfter, type SnapshotState, type SnapshotStore } from "./snapshotRepository";
import { getDocument, putDocument, requestPersistentStorage } from "./webStorage";

/** The IndexedDB document that holds the whole app state (see `webStorage.ts`). */
export const STATE_KEY = "state";

/**
 * What the web build saves: a backup, so that `parseBackup` validates it and
 * upgrades documents written by older versions, plus what a backup file
 * deliberately leaves out: the credentials, the local Steam lists and the
 * id counters.
 */
export interface StoredState extends Backup {
  nextGameId: number;
  nextSessionId: number;
}

export function toStoredState(state: SnapshotState, now: Date = new Date()): StoredState {
  return {
    app: "game-backlog",
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    settings: { ...state.settings },
    games: state.games.map((game) => ({ ...game })),
    sessions: state.sessions.map((session) => ({ ...session })),
    nextGameId: state.nextGameId,
    nextSessionId: state.nextSessionId,
  };
}

/** Read a saved document back; throws a `BackupError` when it is not one. */
export function fromStoredState(raw: unknown): SnapshotState {
  const backup = parseBackup(JSON.stringify(raw));
  const doc = raw as Record<string, unknown>; // parseBackup accepted it, so it is an object
  return {
    settings: { ...backup.settings, ...localSettingsOf(doc.settings) },
    games: backup.games,
    sessions: backup.sessions,
    nextGameId: Math.max(counter(doc.nextGameId), nextIdAfter(backup.games)),
    nextSessionId: Math.max(counter(doc.nextSessionId), nextIdAfter(backup.sessions)),
  };
}

type LocalSettings = Pick<
  Settings,
  "igdbClientId" | "igdbClientSecret" | "igdbAccessToken" | "igdbTokenExpiresAt" | "steamApiKey" | "steamId" | "steamHiddenApps" | "steamDismissedHints"
>;

/** The settings `parseBackup` blanks, read straight from the document with the same leniency as the SQLite settings table. */
function localSettingsOf(value: unknown): LocalSettings {
  const s = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  const text = (field: unknown) => (typeof field === "string" ? field : "");
  const asJson = (field: unknown) => (Array.isArray(field) ? JSON.stringify(field) : null);
  return {
    igdbClientId: text(s.igdbClientId),
    igdbClientSecret: text(s.igdbClientSecret),
    igdbAccessToken: text(s.igdbAccessToken),
    igdbTokenExpiresAt: typeof s.igdbTokenExpiresAt === "number" && Number.isFinite(s.igdbTokenExpiresAt) ? s.igdbTokenExpiresAt : 0,
    steamApiKey: text(s.steamApiKey),
    steamId: text(s.steamId),
    steamHiddenApps: parseHiddenApps(asJson(s.steamHiddenApps)),
    steamDismissedHints: parseDismissedHints(asJson(s.steamDismissedHints)),
  };
}

function counter(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 ? value : 1;
}

export type SaveListener = (state: SnapshotState) => void;
const saveListeners = new Set<SaveListener>();

/** Hear about every state the web store saved, after it is safely in IndexedDB; the sync engine mirrors it. */
export function onWebStateSaved(listener: SaveListener): () => void {
  saveListeners.add(listener);
  return () => saveListeners.delete(listener);
}

export function createWebStore(): SnapshotStore {
  return {
    async load() {
      void requestPersistentStorage();
      const raw = await getDocument<unknown>(STATE_KEY);
      return raw === undefined ? null : fromStoredState(raw);
    },
    async save(state) {
      await putDocument(STATE_KEY, toStoredState(state));
      for (const listener of saveListeners) listener(state);
    },
  };
}

/**
 * The repository of the web build: the snapshot repository saved to
 * IndexedDB. A new user starts with an empty plan and adds their own games
 * (or imports a backup); the seed plan is the desktop app's first run only.
 */
export function createWebRepository(): Repository {
  return createSnapshotRepository(createWebStore(), { firstRun: emptyState });
}
