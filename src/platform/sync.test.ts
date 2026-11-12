/**
 * The sync engine against a fake server and the real web repository on
 * fake-indexeddb: pushes, pulls, conflicts, the invite code, and offline.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildSeedGames } from "../domain/seed";
import type { SyncMeta } from "../domain/sync";
import type { GameInput, Repository } from "../db/repository";
import { createSnapshotRepository, emptyState, type SnapshotState, type SnapshotStore } from "../db/snapshotRepository";
import { STATE_KEY, createWebRepository, onWebStateSaved, type StoredState } from "../db/webRepository";
import { getDocument } from "../db/webStorage";
import {
  SYNC_META_KEY,
  SyncError,
  createSyncEngine,
  decodeDocument,
  describeConflict,
  encodeDocument,
  toRemoteDocument,
  type FetchResult,
  type PushResult,
  type RemoteDocument,
  type SyncApi,
  type SyncEngine,
  type SyncState,
} from "./sync";

beforeEach(() => {
  indexedDB = new IDBFactory() as unknown as typeof indexedDB;
});

const gameInput = (title: string): GameInput => ({
  title,
  type: "linear",
  genre: null,
  platform: "pc",
  together: false,
  casualHours: 10,
  series: null,
  seriesOrder: null,
  note: null,
  source: null,
  externalId: null,
  coverUrl: null,
  releaseDate: null,
  providerGenres: [],
  providerTags: [],
  details: null,
});

async function addGame(repo: Repository, title: string) {
  const { games } = await repo.load();
  const ids = games.filter((g) => g.platform === "pc" && g.position !== null).sort((a, b) => a.position! - b.position!).map((g) => g.id);
  await repo.addPlannedGame(gameInput(title), { plan: "pc", ids: [...ids, "new"] });
}

/** A server that behaves like worker/sync.ts, with switches for the tests. */
function fakeServer() {
  const server = {
    remote: null as RemoteDocument | null,
    inviteCode: null as string | null,
    offline: false,
    puts: 0,
    gets: 0,
    async titles() {
      return server.remote ? (await decodeDocument(server.remote.bytes)).games.map((g) => g.title) : null;
    },
    api: {
      async get(_key, known): Promise<FetchResult> {
        server.gets++;
        if (server.offline) throw new SyncError("network");
        if (!server.remote) return { kind: "missing" };
        if (known === server.remote.revision) return { kind: "unchanged", revision: known };
        return { kind: "document", remote: server.remote };
      },
      async put(_key, base, bytes, invite): Promise<PushResult> {
        server.puts++;
        if (server.offline) throw new SyncError("network");
        if (base === 0 && !server.remote && server.inviteCode && invite !== server.inviteCode) return { kind: "invite-required" };
        if ((base === 0 && server.remote) || (base > 0 && server.remote?.revision !== base)) return { kind: "conflict", remote: server.remote };
        server.remote = { revision: base + 1, updatedAt: `2026-11-10T12:00:0${base + 1}.000Z`, bytes };
        return { kind: "stored", revision: base + 1, updatedAt: server.remote.updatedAt };
      },
      async remove() {
        server.remote = null;
      },
    } satisfies SyncApi,
  };
  return server;
}

const randomBytes = (n: number) => new Uint8Array(n).map((_, i) => i * 7);

/** The engine in this test's browser: the real web repository on fake-indexeddb, wired like the app wires it. */
function browser(server: ReturnType<typeof fakeServer>) {
  const repository = createWebRepository();
  const states: SyncState[] = [];
  const onPulled = vi.fn();
  const engine: SyncEngine = createSyncEngine({ repository, api: server.api, onChange: (s) => states.push(s), onPulled, randomBytes });
  const unsubscribe = onWebStateSaved((state) => engine.noteSaved(state));
  return { repository, engine, states, onPulled, unsubscribe };
}

/**
 * An engine whose `SyncMeta` lives in memory, for tests that assert what was (not) saved: every engine
 * here makes the same key from `randomBytes`, and ones left from earlier tests still write the shared document.
 */
function browserWithOwnMeta(server: ReturnType<typeof fakeServer>) {
  const saved: { meta: SyncMeta | null } = { meta: null };
  const metaStore = {
    load: async () => saved.meta,
    save: async (meta: SyncMeta) => {
      saved.meta = meta;
    },
    clear: async () => {
      saved.meta = null;
    },
  };
  const repository = createWebRepository();
  const engine = createSyncEngine({ repository, api: server.api, onChange: () => undefined, onPulled: vi.fn(), randomBytes, metaStore });
  return { repository, engine, saved };
}

/**
 * A separate device: its own plan store and its own sync record, so two of
 * them share nothing but the fake server (fake-indexeddb is one browser).
 */
function device(server: ReturnType<typeof fakeServer>) {
  let saved: SnapshotState | null = null;
  let engine: SyncEngine | null = null;
  const store: SnapshotStore = {
    async load() {
      return saved;
    },
    async save(state) {
      saved = state;
      engine?.noteSaved(state);
    },
  };
  const repository = createSnapshotRepository(store, { firstRun: emptyState });
  let meta: SyncMeta | null = null;
  const metaStore = {
    async load() {
      return meta;
    },
    async save(next: SyncMeta) {
      meta = next;
    },
    async clear() {
      meta = null;
    },
  };
  const onPulled = vi.fn();
  engine = createSyncEngine({ repository, api: server.api, onChange: () => undefined, onPulled, randomBytes, metaStore });
  return { repository, engine, onPulled };
}

describe("sync engine", () => {
  it("enable makes a key, pushes the plan without secrets, and remembers revision 1", async () => {
    const server = fakeServer();
    const { repository, engine } = browser(server);
    await repository.load();
    await repository.saveSettings({ igdbClientSecret: "secret", steamApiKey: "key" });
    await addGame(repository, "Hades");

    await engine.enable();
    const state = engine.state();
    expect(state.kind).toBe("idle");
    if (state.kind !== "idle") return;
    expect(state.meta.key).toMatch(/^[A-Z2-7]{32}$/);
    expect(state.meta.revision).toBe(1);
    expect(state.meta.dirty).toBe(false);
    expect(await server.titles()).toEqual(["Hades"]);
    const pushed = await decodeDocument(server.remote!.bytes);
    expect(pushed.settings.igdbClientSecret).toBe("");
    expect(pushed.settings.steamApiKey).toBe("");
    expect(await getDocument(SYNC_META_KEY)).toMatchObject({ key: state.meta.key, revision: 1, dirty: false });
  });

  it("every local save is pushed, and a burst collapses into at most one push per save that lands", async () => {
    const server = fakeServer();
    const { repository, engine } = browser(server);
    await repository.load();
    await engine.enable();
    expect(server.puts).toBe(1);

    await addGame(repository, "Celeste");
    await addGame(repository, "Hollow Knight");
    await engine.check();
    expect(await server.titles()).toEqual(["Celeste", "Hollow Knight"]);
    expect(engine.state().kind).toBe("idle");
    expect(server.puts).toBeLessThanOrEqual(3);
  });

  it("keeps a change while offline and pushes it on the next check", async () => {
    const server = fakeServer();
    const { repository, engine } = browser(server);
    await repository.load();
    await engine.enable();

    server.offline = true;
    await addGame(repository, "Offline game");
    await engine.check();
    expect(engine.state()).toMatchObject({ kind: "pending", reason: "offline" });
    expect(await server.titles()).toEqual([]);

    server.offline = false;
    await engine.check();
    expect(engine.state().kind).toBe("idle");
    expect(await server.titles()).toEqual(["Offline game"]);
  });

  it("pulls what another device pushed, keeps local credentials, and does not push it back", async () => {
    const server = fakeServer();
    const first = device(server);
    await first.repository.load();
    await first.engine.enable();
    const key = (first.engine.state() as { meta: { key: string } }).meta.key;

    const second = device(server);
    await second.repository.load();
    await second.repository.saveSettings({ steamApiKey: "mine" });
    await second.engine.connect(key); // empty plan: takes the server's
    expect(second.engine.state().kind).toBe("idle");

    await addGame(first.repository, "From the first device");
    await first.engine.check();
    const putsAfterFirst = server.puts;

    await second.engine.check();
    const { games, settings } = await second.repository.load();
    expect(games.map((g) => g.title)).toEqual(["From the first device"]);
    expect(settings.steamApiKey).toBe("mine");
    expect(second.onPulled).toHaveBeenCalledTimes(2);
    expect(server.puts).toBe(putsAfterFirst);
    expect(second.engine.state()).toMatchObject({ kind: "idle", meta: { revision: server.remote!.revision, dirty: false } });
  });

  it("when both sides changed it stops and lets the user pick a side", async () => {
    const server = fakeServer();
    const a = device(server);
    await a.repository.load();
    await a.engine.enable();
    const key = (a.engine.state() as { meta: { key: string } }).meta.key;
    const b = device(server);
    await b.repository.load();
    await b.engine.connect(key);

    await addGame(a.repository, "A's game");
    await a.engine.check();
    server.offline = true;
    await addGame(b.repository, "B's game");
    await b.engine.check();
    server.offline = false;

    await b.engine.check();
    expect(b.engine.state().kind).toBe("conflict");

    const replacedHere = await b.engine.resolve("take-server");
    expect((await b.repository.load()).games.map((g) => g.title)).toEqual(["A's game"]);
    expect(b.engine.state().kind).toBe("idle");
    expect(replacedHere?.games.map((g) => g.title)).toEqual(["B's game"]); // handed back for Undo

    await addGame(b.repository, "B again");
    await b.engine.check();
    await addGame(a.repository, "A again");
    await a.engine.check();
    expect(a.engine.state().kind).toBe("conflict");
    const replacedOnServer = await a.engine.resolve("keep-mine");
    expect(a.engine.state().kind).toBe("idle");
    expect(await server.titles()).toEqual(["A's game", "A again"]);
    expect(replacedOnServer?.games.map((g) => g.title)).toEqual(["A's game", "B again"]);
  });

  it("undoing a conflict choice puts the replaced plan back here and on the server", async () => {
    const server = fakeServer();
    const a = device(server);
    await a.repository.load();
    await addGame(a.repository, "Server plan");
    await a.engine.enable();
    const key = (a.engine.state() as { meta: { key: string } }).meta.key;
    const b = device(server);
    await b.repository.load();
    await addGame(b.repository, "Local plan");
    await b.engine.connect(key);

    const replaced = await b.engine.resolve("take-server");
    expect((await b.repository.load()).games.map((g) => g.title)).toEqual(["Server plan"]);
    // Undo is the store's applyBackup: a local replaceAll, which sync then pushes.
    await b.repository.replaceAll(replaced!);
    await b.engine.check();
    expect((await b.repository.load()).games.map((g) => g.title)).toEqual(["Local plan"]);
    expect(await server.titles()).toEqual(["Local plan"]);
    expect(b.engine.state().kind).toBe("idle");
  });

  it("joining a key on a device that already has a plan asks which side to keep", async () => {
    const server = fakeServer();
    const a = device(server);
    await a.repository.load();
    await addGame(a.repository, "Server plan");
    await a.engine.enable();
    const key = (a.engine.state() as { meta: { key: string } }).meta.key;

    const b = device(server);
    await b.repository.load();
    await addGame(b.repository, "Local plan");
    await b.engine.connect(key);
    expect(b.engine.state().kind).toBe("conflict");
    await b.engine.resolve("keep-mine");
    expect(await server.titles()).toEqual(["Local plan"]);
  });

  it("sums up both copies of a conflict for the dialog", async () => {
    const { repository } = browser(fakeServer());
    await repository.load();
    await addGame(repository, "Mine");
    const local = await getDocument<StoredState>(STATE_KEY);
    const state = await repository.load();
    const theirs: SnapshotState = {
      ...state,
      games: [...state.games, { ...state.games[0], id: 99, title: "Theirs", status: "completed" }],
      sessions: [{ id: 1, gameId: 99, playedOn: "2026-11-10", hours: 2.5, note: null }],
      nextGameId: 100,
      nextSessionId: 2,
    };
    const remote = { revision: 3, updatedAt: "2026-11-11T12:00:00.000Z", bytes: await encodeDocument(toRemoteDocument(theirs)) };

    const sides = await describeConflict(local, remote);
    expect(sides.device).toEqual({ inPlan: 1, finished: 0, hoursLogged: 0, changedAt: local!.exportedAt });
    expect(sides.server).toEqual({ inPlan: 1, finished: 1, hoursLogged: 2.5, changedAt: "2026-11-11T12:00:00.000Z" });
  });

  it("joining a key with nothing stored under it saves nothing and creates nothing", async () => {
    const server = fakeServer();
    const { repository, engine, saved } = browserWithOwnMeta(server);
    await repository.load();
    expect(await engine.connect("ABCD-EFGH-IJKL-MNOP-QRST-UVWX-YZ23-4567")).toBe("not-found");
    expect(engine.state().kind).toBe("off");
    expect(server.puts).toBe(0);
    expect(saved.meta).toBeNull();
  });

  it("giving up on a refused new key turns sync off again", async () => {
    const server = fakeServer();
    server.inviteCode = "friends-only";
    const { repository, engine, saved } = browserWithOwnMeta(server);
    await repository.load();
    await engine.enable();
    expect(engine.state().kind).toBe("invite-required");
    expect(saved.meta).not.toBeNull(); // the new key was kept while waiting for the code
    await engine.disable();
    expect(engine.state().kind).toBe("off");
    expect(saved.meta).toBeNull();
    expect(server.remote).toBeNull();
  });

  it("asks for the invite code when the server requires one for a new key", async () => {
    const server = fakeServer();
    server.inviteCode = "friends-only";
    const { repository, engine } = browser(server);
    await repository.load();
    await engine.enable();
    expect(engine.state().kind).toBe("invite-required");
    await engine.enable("friends-only");
    expect(engine.state().kind).toBe("idle");
  });

  it("start restores the saved key and compares with the server", async () => {
    const server = fakeServer();
    const first = browser(server);
    await first.repository.load();
    await first.engine.enable();
    first.unsubscribe();

    const again = browser(server);
    await again.engine.start();
    expect(again.engine.state()).toMatchObject({ kind: "idle", meta: { revision: 1 } });
    expect(server.gets).toBeGreaterThan(0);
  });

  it("disable keeps the server copy; deleteServerCopy removes it", async () => {
    const server = fakeServer();
    const { repository, engine } = browser(server);
    await repository.load();
    await engine.enable();
    await engine.disable();
    expect(engine.state().kind).toBe("off");
    expect(server.remote).not.toBeNull();
    expect(await getDocument(SYNC_META_KEY)).toBeUndefined();

    await engine.enable();
    await engine.deleteServerCopy();
    expect(server.remote).toBeNull();
    expect(engine.state().kind).toBe("off");
  });
});

describe("document codec", () => {
  it("round-trips a plan through gzip and leaves secrets out", async () => {
    const games = buildSeedGames();
    const state = { settings: { ...(await createWebRepository().load()).settings, igdbClientId: "id" }, games, sessions: [], nextGameId: 100, nextSessionId: 5 };
    const document: StoredState = toRemoteDocument(state);
    expect(document.settings.igdbClientId).toBe("");
    const bytes = await encodeDocument(document);
    expect(bytes.byteLength).toBeLessThan(JSON.stringify(document).length / 2);
    const back = await decodeDocument(bytes);
    expect(back.games).toHaveLength(games.length);
    expect(back.nextGameId).toBe(100);
  });
});
