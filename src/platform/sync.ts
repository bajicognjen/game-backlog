/**
 * Mirrors the web build's plan to the server copy (worker/sync.ts) and
 * brings another device's changes back. The browser's IndexedDB stays the
 * working copy: every save is pushed afterwards, in the background, and a
 * push that fails is retried on the next save, when the page becomes
 * visible, or when the browser comes back online. On load and on those
 * occasions the server revision is compared with ours (`reconcile`): only
 * the server moved, pull; only we moved, push; both moved, a conflict the
 * user resolves. The document sent is the backup document, so credentials
 * never leave the browser; it is gzip-compressed here, and the Worker stores
 * it as opaque bytes.
 */
import { BACKUP_VERSION, type Backup } from "../domain/backup";
import {
  BASE_REVISION_HEADER,
  INVITE_HEADER,
  KNOWN_REVISION_HEADER,
  REVISION_HEADER,
  SYNC_KEY_HEADER,
  SYNC_PATH,
  UPDATED_AT_HEADER,
  normaliseSyncKey,
  readSyncKey,
  reconcile,
  summarizePlan,
  syncKeyFromBytes,
  type PlanSummary,
  type SyncMeta,
} from "../domain/sync";
import type { Repository } from "../db/repository";
import { nextIdAfter, type SnapshotState } from "../db/snapshotRepository";
import { fromStoredState, toStoredState, type StoredState } from "../db/webRepository";
import { deleteDocument, getDocument, putDocument } from "../db/webStorage";

/** The IndexedDB document that holds `SyncMeta`; absent while sync is off. */
export const SYNC_META_KEY = "sync";

// --- the document on the wire ----------------------------------------------------

/** What is pushed: the saved state without the secrets a backup leaves out. */
export function toRemoteDocument(state: SnapshotState, now: Date = new Date()): StoredState {
  const stored = toStoredState(state, now);
  return {
    ...stored,
    settings: { ...stored.settings, igdbClientId: "", igdbClientSecret: "", igdbAccessToken: "", igdbTokenExpiresAt: 0, steamApiKey: "", steamId: "", steamHiddenApps: [], steamDismissedHints: [] },
  };
}

export async function encodeDocument(document: StoredState): Promise<Uint8Array> {
  const stream = new Blob([JSON.stringify(document)]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Back to a validated state; throws a `BackupError` for anything that is not a document of ours. */
export async function decodeDocument(bytes: Uint8Array): Promise<SnapshotState> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream("gzip"));
  return fromStoredState(JSON.parse(await new Response(stream).text()));
}

type PlanContent = Pick<SnapshotState, "settings" | "games" | "sessions">;

/**
 * Whether two copies hold the same plan: the same games, sessions and plan settings. What differs between devices
 * without changing the plan does not count: when each was written, the id counters, the credentials and Steam
 * lists (never synced) and the theme. Two copies that match need no choice between them.
 */
export function samePlan(a: PlanContent, b: PlanContent): boolean {
  return stableJson(planContent(a)) === stableJson(planContent(b));
}

function planContent(plan: PlanContent) {
  const { settings } = toRemoteDocument({ ...plan, nextGameId: 0, nextSessionId: 0 }, new Date(0));
  const { theme: _theme, ...planSettings } = settings;
  const byId = (x: { id: number }, y: { id: number }) => x.id - y.id;
  return { settings: planSettings, games: [...plan.games].sort(byId), sessions: [...plan.sessions].sort(byId) };
}

/** JSON with every object's keys in one order, so the same content always reads the same. */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(Object.entries(inner as Record<string, unknown>).sort(([x], [y]) => (x < y ? -1 : x > y ? 1 : 0)))
      : inner,
  );
}

/** A plan in the shape `replaceAll` (and the store's `applyBackup`) takes. */
function asBackup(plan: Pick<SnapshotState, "settings" | "games" | "sessions">, exportedAt: string): Backup {
  return { app: "game-backlog", version: BACKUP_VERSION, exportedAt, settings: plan.settings, games: plan.games, sessions: plan.sessions };
}

// --- a conflict, side by side ----------------------------------------------------------

/** One copy of the plan as the conflict dialog shows it; `changedAt` is when that copy was last written (ISO). */
export interface ConflictSide extends PlanSummary {
  changedAt: string | null;
  /** Every game's title on this copy (planned and finished), for what only one copy has. */
  titles: string[];
}

export interface ConflictSides {
  device: ConflictSide;
  server: ConflictSide;
}

/** This browser's saved plan (the stored document, stamped at every save) against the server's copy. */
export async function describeConflict(local: StoredState | undefined, remote: RemoteDocument): Promise<ConflictSides> {
  const server = await decodeDocument(remote.bytes);
  return {
    device: { ...summarizePlan(local?.games ?? [], local?.sessions ?? []), changedAt: local?.exportedAt ?? null, titles: (local?.games ?? []).map((g) => g.title) },
    server: { ...summarizePlan(server.games, server.sessions), changedAt: remote.updatedAt, titles: server.games.map((g) => g.title) },
  };
}

// --- the server ---------------------------------------------------------------------

export interface RemoteDocument {
  revision: number;
  updatedAt: string;
  bytes: Uint8Array;
}

export type FetchResult = { kind: "document"; remote: RemoteDocument } | { kind: "unchanged"; revision: number } | { kind: "missing" };
export type PushResult =
  | { kind: "stored"; revision: number; updatedAt: string }
  | { kind: "conflict"; remote: RemoteDocument | null }
  | { kind: "invite-required" }
  | { kind: "too-large" };

/** The three calls of worker/sync.ts; network trouble and unexpected answers throw a `SyncError`. */
export interface SyncApi {
  get(key: string, knownRevision: number | null): Promise<FetchResult>;
  put(key: string, baseRevision: number, bytes: Uint8Array, inviteCode: string | null): Promise<PushResult>;
  remove(key: string): Promise<void>;
}

export class SyncError extends Error {
  constructor(
    public readonly reason: "network" | "other",
    public readonly status: number | null = null,
  ) {
    super(reason);
    this.name = "SyncError";
  }
}

export function createSyncApi(fetchImpl: typeof fetch = (...args) => fetch(...args)): SyncApi {
  async function call(init: RequestInit & { headers: Record<string, string> }): Promise<Response> {
    try {
      return await fetchImpl(SYNC_PATH, { ...init, cache: "no-store" });
    } catch {
      throw new SyncError("network");
    }
  }
  const remoteOf = async (response: Response): Promise<RemoteDocument> => ({
    revision: Number(response.headers.get(REVISION_HEADER)),
    updatedAt: response.headers.get(UPDATED_AT_HEADER) ?? "",
    bytes: new Uint8Array(await response.arrayBuffer()),
  });
  return {
    async get(key, knownRevision) {
      const headers: Record<string, string> = { [SYNC_KEY_HEADER]: key };
      if (knownRevision !== null) headers[KNOWN_REVISION_HEADER] = String(knownRevision);
      const response = await call({ method: "GET", headers });
      if (response.status === 200) return { kind: "document", remote: await remoteOf(response) };
      if (response.status === 304) return { kind: "unchanged", revision: Number(response.headers.get(REVISION_HEADER)) };
      if (response.status === 404) return { kind: "missing" };
      throw new SyncError("other", response.status);
    },
    async put(key, baseRevision, bytes, inviteCode) {
      const headers: Record<string, string> = { [SYNC_KEY_HEADER]: key, [BASE_REVISION_HEADER]: String(baseRevision), "Content-Type": "application/octet-stream" };
      if (inviteCode) headers[INVITE_HEADER] = inviteCode;
      const response = await call({ method: "PUT", headers, body: bytes as BodyInit });
      if (response.status === 200) {
        const body = (await response.json()) as { revision: number; updatedAt: string };
        return { kind: "stored", revision: body.revision, updatedAt: body.updatedAt };
      }
      if (response.status === 409) return { kind: "conflict", remote: response.headers.has(REVISION_HEADER) ? await remoteOf(response) : null };
      if (response.status === 403) return { kind: "invite-required" };
      if (response.status === 413) return { kind: "too-large" };
      throw new SyncError("other", response.status);
    },
    async remove(key) {
      const response = await call({ method: "DELETE", headers: { [SYNC_KEY_HEADER]: key } });
      if (response.status !== 204) throw new SyncError("other", response.status);
    },
  };
}

// --- the engine ----------------------------------------------------------------------

export type SyncState =
  | { kind: "off" }
  /** Everything this browser has is on the server. */
  | { kind: "idle"; meta: SyncMeta }
  | { kind: "syncing"; meta: SyncMeta }
  /** A local change is waiting to be pushed; `reason` says why the last attempt failed. */
  | { kind: "pending"; meta: SyncMeta; reason: "offline" | "error" | "too-large"; detail: string | null }
  /** Both sides changed; the user picks a side with `resolve`. */
  | { kind: "conflict"; meta: SyncMeta; remote: RemoteDocument }
  /** The server wants the invite code before it stores a new key; `enable` again with it, or `disable` to give up. */
  | { kind: "invite-required"; meta: SyncMeta }
  /**
   * The server copy this device synced with is gone (deleted from another device). Nothing is put back
   * on its own: `enable` starts again under a new key with this device's plan (the deleted key, and every
   * link and QR code made from it, stays dead), `disable` stops here.
   */
  | { kind: "gone"; meta: SyncMeta };

export type ConflictChoice = "keep-mine" | "take-server";

/** How a check went: the server answered (whatever followed), it could not be reached, or there was nothing to check. */
export type CheckResult = "answered" | "unreachable" | "skipped";

/** How joining a key went: `not-found` means nothing is stored under it, and nothing was saved on this device. */
export type ConnectResult = "connected" | "not-found";

export interface SyncEngine {
  /** Load what this browser knows and compare with the server once. */
  start(): Promise<void>;
  /** Make a new key and put this browser's plan on the server under it (after a refused invite code, the key already made). */
  enable(inviteCode?: string | null): Promise<void>;
  /**
   * Join an existing key: take its plan when this browser has none, otherwise ask (a conflict) which side to keep.
   * A key with nothing stored under it is most likely mistyped, so it is not saved and no new plan is created.
   */
  connect(key: string): Promise<ConnectResult>;
  /** Stop syncing on this browser; the server copy stays. */
  disable(): Promise<void>;
  /**
   * Undo of `disable`: sync again with the same key, as it was. Marked as having a change to send,
   * since a save made while sync was off went nowhere; if the server moved on meanwhile, that is a conflict.
   */
  restore(previous: SyncMeta): Promise<void>;
  /** Remove the server copy and stop syncing. */
  deleteServerCopy(): Promise<void>;
  /**
   * Settle a conflict by keeping one side. Resolves with the plan that was replaced (this device's for
   * "take-server", the server's for "keep-mine") so the choice can be undone, or null when there was none.
   */
  resolve(choice: ConflictChoice): Promise<Backup | null>;
  /** Compare with the server now (on load, when the page becomes visible, when back online). */
  check(): Promise<CheckResult>;
  /** Hear about a local save (wired to `onWebStateSaved`). */
  noteSaved(state: SnapshotState): void;
  state(): SyncState;
}

export interface SyncEngineDeps {
  repository: Repository;
  api: SyncApi;
  onChange(state: SyncState): void;
  /** The plan was replaced with the server's; the UI reloads. */
  onPulled(): void | Promise<void>;
  now?: () => Date;
  randomBytes?: (length: number) => Uint8Array;
  /** Where `SyncMeta` is kept; IndexedDB unless a test says otherwise. */
  metaStore?: { load(): Promise<SyncMeta | null>; save(meta: SyncMeta): Promise<void>; clear(): Promise<void> };
}

export function createSyncEngine(deps: SyncEngineDeps): SyncEngine {
  const now = deps.now ?? (() => new Date());
  const random = deps.randomBytes ?? ((length: number) => crypto.getRandomValues(new Uint8Array(length)));
  const metaStore = deps.metaStore ?? indexedDbMetaStore();

  let state: SyncState = { kind: "off" };
  /** The newest local state not yet pushed, kept while a push is in flight so bursts collapse into one. */
  let unsent: SnapshotState | null = null;
  /** True while a pulled document is being written locally; that save must not be pushed back. */
  let applyingRemote = false;
  /** Operations run one after another. */
  let chain: Promise<unknown> = Promise.resolve();

  function set(next: SyncState): void {
    state = next;
    deps.onChange(next);
  }
  const meta = (): SyncMeta | null => (state.kind === "off" ? null : state.meta);

  function run<T>(task: () => Promise<T>): Promise<T> {
    const result = chain.then(task);
    chain = result.catch(() => undefined);
    return result;
  }

  async function saveMeta(next: SyncMeta): Promise<SyncMeta> {
    await metaStore.save(next);
    return next;
  }

  async function currentDocument(): Promise<StoredState> {
    if (unsent) return toRemoteDocument(unsent, now());
    const { games, settings, sessions } = await deps.repository.load();
    return toRemoteDocument({ settings, games, sessions, nextGameId: nextIdAfter(games), nextSessionId: nextIdAfter(sessions) }, now());
  }

  /** Push the current local state based on `baseRevision`. */
  async function push(current: SyncMeta, baseRevision: number, inviteCode: string | null = null): Promise<void> {
    set({ kind: "syncing", meta: current });
    const document = await currentDocument();
    const snapshot = unsent;
    let result: PushResult;
    try {
      result = await deps.api.put(current.key, baseRevision, await encodeDocument(document), inviteCode);
    } catch (error) {
      const reason = error instanceof SyncError && error.reason === "network" ? "offline" : "error";
      set({ kind: "pending", meta: await saveMeta({ ...current, dirty: true }), reason, detail: error instanceof SyncError && error.status ? `HTTP ${error.status}` : null });
      return;
    }
    if (result.kind === "stored") {
      if (unsent === snapshot) unsent = null; // nothing newer arrived meanwhile
      const synced = await saveMeta({ ...current, revision: result.revision, dirty: unsent !== null, lastSyncedAt: result.updatedAt });
      if (unsent) return push(synced, synced.revision);
      set({ kind: "idle", meta: synced });
      return;
    }
    if (result.kind === "conflict") {
      const remote = result.remote ?? (await fetchRemote(current.key));
      const dirty = await saveMeta({ ...current, dirty: true });
      if (remote && (await adoptIfSame(dirty, remote))) return;
      if (remote) set({ kind: "conflict", meta: dirty, remote });
      else if (baseRevision > 0) set({ kind: "gone", meta: dirty }); // the copy it was based on is no longer there
      else set({ kind: "pending", meta: dirty, reason: "error", detail: "conflict" });
      return;
    }
    if (result.kind === "invite-required") {
      set({ kind: "invite-required", meta: await saveMeta({ ...current, dirty: true }) });
      return;
    }
    set({ kind: "pending", meta: await saveMeta({ ...current, dirty: true }), reason: "too-large", detail: null });
  }

  /**
   * Both sides changed, or a device joins with a plan of its own, but the two copies hold the same plan (a rejoin
   * after Turn off, two devices that made the same edit): take the server's revision and carry on. There is
   * nothing to choose between, so nothing is asked.
   */
  async function adoptIfSame(current: SyncMeta, remote: RemoteDocument): Promise<boolean> {
    let server: SnapshotState;
    try {
      server = await decodeDocument(remote.bytes);
    } catch {
      return false; // an unreadable server copy is the conflict dialog's to show
    }
    const local = unsent ?? (await deps.repository.load());
    if (!samePlan(local, server)) return false;
    unsent = null;
    set({ kind: "idle", meta: await saveMeta({ ...current, revision: remote.revision, dirty: false, lastSyncedAt: now().toISOString() }) });
    return true;
  }

  async function fetchRemote(key: string): Promise<RemoteDocument | null> {
    const result = await deps.api.get(key, null);
    return result.kind === "document" ? result.remote : null;
  }

  /** Replace the local plan with the server's document and record its revision. */
  async function pull(current: SyncMeta, remote: RemoteDocument): Promise<void> {
    set({ kind: "syncing", meta: current });
    const backup = asBackup(await decodeDocument(remote.bytes), remote.updatedAt);
    applyingRemote = true;
    try {
      await deps.repository.replaceAll(backup);
    } finally {
      applyingRemote = false;
    }
    unsent = null;
    set({ kind: "idle", meta: await saveMeta({ ...current, revision: remote.revision, dirty: false, lastSyncedAt: now().toISOString() }) });
    await deps.onPulled();
  }

  /** Ask the server and act on what it says; false when it could not be reached. */
  async function compare(current: SyncMeta): Promise<boolean> {
    let result: FetchResult;
    try {
      result = await deps.api.get(current.key, current.revision);
    } catch (error) {
      if (current.dirty) set({ kind: "pending", meta: current, reason: error instanceof SyncError && error.reason === "network" ? "offline" : "error", detail: null });
      else set({ kind: "idle", meta: current });
      return false;
    }
    // Synced before and now nothing under the key: the copy was deleted. Say so rather than quietly storing it again.
    if (result.kind === "missing" && current.revision > 0) {
      set({ kind: "gone", meta: current });
      return true;
    }
    const remoteRevision = result.kind === "missing" ? null : result.kind === "unchanged" ? result.revision : result.remote.revision;
    switch (reconcile(current, remoteRevision)) {
      case "nothing":
        set({ kind: "idle", meta: current });
        break;
      case "push":
        await push(current, remoteRevision ?? 0);
        break;
      case "pull":
        await pull(current, result.kind === "document" ? result.remote : (await fetchRemote(current.key))!);
        break;
      case "conflict": {
        const remote = result.kind === "document" ? result.remote : await fetchRemote(current.key);
        if (remote && (await adoptIfSame(current, remote))) break;
        if (remote) set({ kind: "conflict", meta: current, remote });
        else await push(current, 0);
        break;
      }
    }
    return true;
  }

  return {
    state: () => state,

    start: () =>
      run(async () => {
        const saved = await metaStore.load();
        if (!saved) return;
        set(saved.dirty ? { kind: "pending", meta: saved, reason: "offline", detail: null } : { kind: "idle", meta: saved });
        await compare(saved);
      }),

    enable: (inviteCode = null) =>
      run(async () => {
        // A refused invite code keeps the key it was refused for; a deleted copy's key is never brought back.
        const kept = state.kind === "gone" ? null : meta();
        const current = kept ?? (await saveMeta({ key: syncKeyFromBytes(random(20)), revision: 0, dirty: true, lastSyncedAt: null }));
        await push(current, 0, inviteCode);
      }),

    connect: (input) =>
      run(async (): Promise<ConnectResult> => {
        const key = readSyncKey(input);
        if (!key) throw new Error("Not a sync key");
        const remote = await fetchRemote(key);
        if (!remote) return "not-found";
        const current = await saveMeta({ key, revision: 0, dirty: true, lastSyncedAt: null });
        const local = await deps.repository.load();
        if (local.games.length === 0 && local.sessions.length === 0) {
          await pull(current, remote);
          return "connected";
        }
        // The same plan on both (a device rejoining its own key): joined, with the same "Joined" word as a pull.
        if (await adoptIfSame(current, remote)) {
          await deps.onPulled();
          return "connected";
        }
        set({ kind: "conflict", meta: current, remote });
        return "connected";
      }),

    disable: () =>
      run(async () => {
        await metaStore.clear();
        unsent = null;
        set({ kind: "off" });
      }),

    restore: (previous) =>
      run(async () => {
        if (meta()) return; // turned on again some other way meanwhile
        const current = await saveMeta({ ...previous, dirty: true });
        set({ kind: "pending", meta: current, reason: "offline", detail: null });
        await compare(current);
      }),

    deleteServerCopy: () =>
      run(async () => {
        const current = meta();
        if (current) await deps.api.remove(current.key);
        await metaStore.clear();
        unsent = null;
        set({ kind: "off" });
      }),

    resolve: (choice) =>
      run(async (): Promise<Backup | null> => {
        if (state.kind !== "conflict") return null;
        const { meta: current, remote } = state;
        if (choice === "take-server") {
          // This device's plan is about to go: keep it, so the choice can be undone.
          const mine = asBackup(await deps.repository.load(), now().toISOString());
          await pull(current, remote);
          return mine;
        }
        // The server's copy is about to be overwritten; an unreadable one cannot be offered back.
        const theirs = await decodeDocument(remote.bytes).then(
          (plan) => asBackup(plan, remote.updatedAt),
          () => null,
        );
        await push(current, remote.revision);
        return theirs;
      }),

    check: () =>
      run(async (): Promise<CheckResult> => {
        const current = meta();
        if (!current || state.kind === "conflict" || state.kind === "invite-required") return "skipped";
        return (await compare(current)) ? "answered" : "unreachable";
      }),

    noteSaved(saved) {
      if (applyingRemote) return;
      const current = meta();
      if (!current) return;
      unsent = saved;
      void run(async () => {
        const latest = meta();
        if (!latest || !unsent || state.kind === "conflict" || state.kind === "invite-required" || state.kind === "gone") return;
        await push(await saveMeta({ ...latest, dirty: true }), latest.revision);
      });
    },
  };
}

function indexedDbMetaStore(): NonNullable<SyncEngineDeps["metaStore"]> {
  return {
    async load() {
      const raw = await getDocument<unknown>(SYNC_META_KEY);
      if (typeof raw !== "object" || raw === null) return null;
      const m = raw as Record<string, unknown>;
      const key = typeof m.key === "string" ? normaliseSyncKey(m.key) : null;
      if (!key) return null;
      return {
        key,
        revision: typeof m.revision === "number" && Number.isInteger(m.revision) && m.revision >= 0 ? m.revision : 0,
        dirty: m.dirty === true,
        lastSyncedAt: typeof m.lastSyncedAt === "string" ? m.lastSyncedAt : null,
      };
    },
    save: (meta) => putDocument(SYNC_META_KEY, meta),
    clear: () => deleteDocument(SYNC_META_KEY),
  };
}
