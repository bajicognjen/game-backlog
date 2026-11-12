/**
 * The web build's repository: the snapshot repository saved to IndexedDB.
 * Each test starts from an empty browser database.
 */
import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it } from "vitest";
import { BACKUP_VERSION, BackupError, createBackup } from "../domain/backup";
import { todayIso } from "../domain/dates";
import { buildSeedGames } from "../domain/seed";
import type { GameInput, Repository } from "./repository";
import { STATE_KEY, createWebRepository, type StoredState } from "./webRepository";
import { getDocument, putDocument } from "./webStorage";

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

/** Add a PC game at the end of the plan and return it. */
async function addGame(repo: Repository, title: string) {
  const { games } = await repo.load();
  const ids = games.filter((g) => g.platform === "pc" && g.position !== null).sort((a, b) => a.position! - b.position!).map((g) => g.id);
  await repo.addPlannedGame(gameInput(title), { plan: "pc", ids: [...ids, "new"] });
  return (await repo.load()).games.find((g) => g.title === title)!;
}

const credentials = {
  igdbClientId: "client",
  igdbClientSecret: "secret",
  igdbAccessToken: "token",
  igdbTokenExpiresAt: 1_800_000_000_000,
  steamApiKey: "steam-key",
  steamId: "76561198000000000",
  steamHiddenApps: [10, 20],
  steamDismissedHints: ["start:1"],
};

describe("web repository", () => {
  it("starts a new user with an empty plan from today, and saves that as a current-version document", async () => {
    const { games, sessions, settings } = await createWebRepository().load();
    expect(games).toEqual([]);
    expect(sessions).toEqual([]);
    expect(settings.startDate).toBe(todayIso());
    expect(settings.hoursPerWeek).toBe(13);

    const saved = await getDocument<StoredState>(STATE_KEY);
    expect(saved?.app).toBe("game-backlog");
    expect(saved?.version).toBe(BACKUP_VERSION);
    expect(saved?.games).toEqual([]);
    expect(saved?.nextGameId).toBe(1);
  });

  it("keeps changes across sessions", async () => {
    const first = createWebRepository();
    const hades = await addGame(first, "Hades");
    await addGame(first, "Celeste");
    await first.addSession({ gameId: hades.id, playedOn: "2026-11-05", hours: 2.5, note: null });

    const again = await createWebRepository().load();
    expect(again.games.map((g) => [g.title, g.position])).toEqual([
      ["Hades", 1],
      ["Celeste", 2],
    ]);
    expect(again.sessions).toEqual([{ id: 1, gameId: hades.id, playedOn: "2026-11-05", hours: 2.5, note: null }]);
    expect(again.games.find((g) => g.id === hades.id)?.hoursPlayed).toBe(2.5);
  });

  it("never hands out a game id twice, even after the newest game was deleted", async () => {
    const repo = createWebRepository();
    const first = await addGame(repo, "First");
    await repo.deleteGame(first.id, { plan: "pc", ids: [] });

    const second = await addGame(createWebRepository(), "Second");
    expect(second.id).toBe(first.id + 1);
  });

  it("keeps the credentials and local Steam lists that backup files leave out", async () => {
    const repo = createWebRepository();
    await repo.load();
    await repo.saveSettings(credentials);

    const { settings } = await createWebRepository().load();
    expect(settings).toMatchObject(credentials);
  });

  it("imports a backup like the desktop app: plan settings from the file, credentials untouched", async () => {
    const repo = createWebRepository();
    const { settings } = await repo.load();
    await repo.saveSettings(credentials);

    const backup = createBackup(buildSeedGames().slice(0, 2), { ...settings, startDate: "2026-12-01", hoursPerWeek: 7 }, []);
    expect(backup.settings.igdbClientSecret).toBe("");
    await repo.replaceAll(backup);

    const after = await createWebRepository().load();
    expect(after.games).toHaveLength(2);
    expect(after.settings.startDate).toBe("2026-12-01");
    expect(after.settings.hoursPerWeek).toBe(7);
    expect(after.settings).toMatchObject(credentials);
  });

  it("upgrades a document written by an older version on load", async () => {
    // Version 10 still stored the old design names; "giant" is "open_world" today.
    await putDocument(STATE_KEY, {
      app: "game-backlog",
      version: 10,
      exportedAt: "2026-11-01T00:00:00.000Z",
      settings: { startDate: "2026-11-02", hoursPerWeek: 13, theme: "dark", igdbClientId: "kept" },
      games: [{ id: 7, title: "Big one", type: "giant", status: "pending", platform: "pc", position: 1, casualHours: 50 }],
      sessions: [],
    });

    const { games, settings } = await createWebRepository().load();
    expect(games).toEqual([expect.objectContaining({ id: 7, type: "open_world", hoursPlayed: 0 })]);
    expect(settings.theme).toBe("dark");
    expect(settings.igdbClientId).toBe("kept");

    // Without saved counters the next id continues after the highest one in the file.
    const next = await addGame(createWebRepository(), "Next");
    expect(next.id).toBe(8);
  });

  it("reports a corrupted document instead of silently starting over", async () => {
    await putDocument(STATE_KEY, { app: "game-backlog", version: BACKUP_VERSION, settings: { startDate: "2026-11-02", hoursPerWeek: 13 }, games: "nope" });
    await expect(createWebRepository().load()).rejects.toBeInstanceOf(BackupError);
    // The bad document is still there for the user to recover from.
    expect(await getDocument(STATE_KEY)).toMatchObject({ games: "nope" });
  });
});
