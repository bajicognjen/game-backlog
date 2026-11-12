/**
 * The pure state changes shared by the memory and web repositories. The
 * store tests exercise the everyday paths; these cover the rules that the
 * SQLite repository enforces in SQL.
 */
import { describe, expect, it } from "vitest";
import { createBackup } from "../domain/backup";
import { plannedIds } from "../domain/plan";
import { createSnapshotRepository, emptyState, type SnapshotState, type SnapshotStore } from "./snapshotRepository";

/** A store that remembers the last saved state, or refuses every save. */
function fakeStore(failing = false): SnapshotStore & { saved: SnapshotState | null; saves: number } {
  const store = {
    saved: null as SnapshotState | null,
    saves: 0,
    async load() {
      return store.saved;
    },
    async save(state: SnapshotState) {
      store.saves++;
      if (failing) throw new Error("quota exceeded");
      store.saved = state;
    },
  };
  return store;
}

describe("snapshot repository", () => {
  it("finishing a game moves the start date and puts the next one in progress", async () => {
    const repo = createSnapshotRepository();
    const { games } = await repo.load();
    const [first, second, ...rest] = plannedIds(games, "pc");
    await repo.finishGame(first, { completedAt: "2026-11-15", rating: 9, review: null, nextStartDate: "2026-11-16", startNext: true }, { plan: "pc", ids: [second, ...rest] });

    const after = await repo.load();
    const finished = after.games.find((g) => g.id === first)!;
    expect(finished).toMatchObject({ status: "completed", position: null, completedAt: "2026-11-15", rating: 9 });
    expect(finished.completedOrder).toBeGreaterThan(0);
    expect(after.games.find((g) => g.id === second)).toMatchObject({ status: "in_progress", position: 1 });
    expect(after.settings.startDate).toBe("2026-11-16");
  });

  it("undo of a delete puts the game and its sessions back", async () => {
    const repo = createSnapshotRepository();
    const { games } = await repo.load();
    const ids = plannedIds(games, "pc");
    await repo.addSession({ gameId: ids[1], playedOn: "2026-11-03", hours: 3, note: "evening" });
    const { games: withHours, sessions } = await repo.load();
    const game = withHours.find((g) => g.id === ids[1])!;

    await repo.deleteGame(game.id, { plan: "pc", ids: ids.filter((id) => id !== game.id) });
    expect((await repo.load()).sessions).toHaveLength(0);

    await repo.reinsertGame(game, sessions, { plan: "pc", ids }, null);
    const after = await repo.load();
    expect(plannedIds(after.games, "pc")).toEqual(ids);
    expect(after.games.find((g) => g.id === game.id)?.hoursPlayed).toBe(3);
    expect(after.sessions).toEqual(sessions);
  });

  it("imports plan settings from the backup and keeps the local credentials", async () => {
    const repo = createSnapshotRepository();
    const { games, settings, sessions } = await repo.load();
    await repo.saveSettings({ igdbClientId: "me", steamApiKey: "key" });
    await repo.replaceAll(createBackup(games, { ...settings, hoursPerWeek: 20 }, sessions));

    const after = await repo.load();
    expect(after.settings.hoursPerWeek).toBe(20);
    expect(after.settings.igdbClientId).toBe("me");
    expect(after.settings.steamApiKey).toBe("key");
  });

  it("saves every change through the store and starts from what the store holds", async () => {
    const store = fakeStore();
    const first = createSnapshotRepository(store);
    await first.load();
    expect(store.saves).toBe(1); // the seed
    await first.saveSettings({ hoursPerWeek: 5 });
    expect(store.saves).toBe(2);

    const second = createSnapshotRepository(store);
    expect((await second.load()).settings.hoursPerWeek).toBe(5);
    expect(store.saves).toBe(2); // nothing to seed
  });

  it("starts from the seed plan by default and from nothing when told so", async () => {
    expect((await createSnapshotRepository().load()).games.length).toBeGreaterThan(0);

    const store = fakeStore();
    const clean = createSnapshotRepository(store, { firstRun: () => emptyState(new Date(2026, 10, 10)) });
    const { games, settings } = await clean.load();
    expect(games).toEqual([]);
    expect(settings.startDate).toBe("2026-11-10");
    expect(store.saved?.nextGameId).toBe(1);
  });

  it("a failed save leaves the state as it was", async () => {
    const store = fakeStore();
    const repo = createSnapshotRepository(store);
    const before = await repo.load();

    const broken = createSnapshotRepository({ load: store.load, save: fakeStore(true).save });
    await expect(broken.saveSettings({ hoursPerWeek: 99 })).rejects.toThrow("quota exceeded");
    expect((await broken.load()).settings.hoursPerWeek).toBe(before.settings.hoursPerWeek);
  });
});
