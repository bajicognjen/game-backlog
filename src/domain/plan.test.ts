import { describe, expect, it } from "vitest";
import { completedIds, insertAt, moveItem, plannedIds, withCompletedOrder, withPlanOrder } from "./plan";
import { buildSeedGames } from "./seed";
import type { Game } from "./types";

describe("withPlanOrder", () => {
  it("renumbers positions and leaves statuses to the user", () => {
    const games = buildSeedGames();
    const ids = plannedIds(games, "pc");
    expect(ids).toHaveLength(27);

    const reordered = withPlanOrder(games, moveItem(ids, 2, 0), "pc"); // Shadows to the top
    const planned = reordered.filter((g) => g.status !== "completed").sort((a, b) => a.position! - b.position!);
    expect(planned[0].title).toBe("Assassin's Creed Shadows");
    expect(planned[0].status).toBe("pending");
    expect(planned[1].title).toBe("Batman: Arkham Knight");
    expect(planned[1].status).toBe("in_progress"); // still the game being played
    expect(planned.map((g) => g.position)).toEqual(ids.map((_, i) => i + 1));
  });

  it("leaves completed games untouched", () => {
    const games = buildSeedGames();
    const before = games.filter((g) => g.status === "completed");
    const after = withPlanOrder(games, plannedIds(games, "pc"), "pc").filter((g) => g.status === "completed");
    expect(after).toEqual(before);
  });

  it("refuses an order that misses a planned game", () => {
    const games = buildSeedGames();
    expect(() => withPlanOrder(games, plannedIds(games, "pc").slice(1), "pc")).toThrow(/missing/);
  });

  it("does not mutate its input", () => {
    const games = buildSeedGames();
    const snapshot = JSON.stringify(games);
    withPlanOrder(games, moveItem(plannedIds(games, "pc"), 0, 5), "pc");
    expect(JSON.stringify(games)).toBe(snapshot);
  });

  it("keeps each platform's plan separate", () => {
    const games: Game[] = [
      ...buildSeedGames(),
      { ...buildSeedGames()[1], id: 101, title: "Spider-Man 2 (PS5)", platform: "ps5", status: "pending", position: 2 },
      { ...buildSeedGames()[1], id: 102, title: "Astro Bot", platform: "ps5", status: "pending", position: 1 },
    ];
    expect(plannedIds(games, "ps5")).toEqual([102, 101]);
    const reordered = withPlanOrder(games, [101, 102], "ps5");
    expect(reordered.find((g) => g.id === 101)).toMatchObject({ position: 1, status: "pending" });
    expect(reordered.find((g) => g.id === 102)).toMatchObject({ position: 2, status: "pending" });
    // PC untouched, Batman still current.
    expect(reordered.find((g) => g.title === "Batman: Arkham Knight")).toMatchObject({ position: 1, status: "in_progress" });
    expect(plannedIds(reordered, "pc")).toEqual(plannedIds(games, "pc"));
  });

  it("handles a plan of one game and an empty plan", () => {
    const single: Game[] = [{ ...buildSeedGames()[1], status: "paused", position: 7 }];
    expect(withPlanOrder(single, [single[0].id], "pc")[0]).toMatchObject({ position: 1, status: "paused" });
    expect(withPlanOrder([], [], "pc")).toEqual([]);
  });
});

describe("withCompletedOrder", () => {
  it("renumbers the finish order and leaves planned games alone", () => {
    const games = buildSeedGames();
    const ids = completedIds(games);
    expect(ids).toHaveLength(10);
    const reordered = withCompletedOrder(games, moveItem(ids, 9, 0)); // Ori to the front
    const done = reordered.filter((g) => g.status === "completed").sort((a, b) => a.completedOrder! - b.completedOrder!);
    expect(done[0].title).toBe("Ori and the Blind Forest DE");
    expect(done[1].title).toBe("Marvel's Spider-Man");
    expect(done.map((g) => g.completedOrder)).toEqual(ids.map((_, i) => i + 1));
    expect(plannedIds(reordered, "pc")).toEqual(plannedIds(games, "pc"));
    expect(() => withCompletedOrder(games, ids.slice(1))).toThrow(/missing/);
  });
});

describe("moveItem / insertAt", () => {
  it("moves items like dnd-kit arrayMove", () => {
    expect(moveItem([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
    expect(moveItem([1, 2, 3, 4], 3, 0)).toEqual([4, 1, 2, 3]);
    expect(moveItem([1, 2, 3, 4], 1, 1)).toEqual([1, 2, 3, 4]);
  });

  it("inserts at an index and clamps to the ends", () => {
    expect(insertAt([1, 2, 3], 9, 0)).toEqual([9, 1, 2, 3]);
    expect(insertAt([1, 2, 3], 9, 1)).toEqual([1, 9, 2, 3]);
    expect(insertAt([1, 2, 3], 9, 3)).toEqual([1, 2, 3, 9]);
    expect(insertAt([1, 2, 3], 9, 42)).toEqual([1, 2, 3, 9]);
    expect(insertAt([1, 2, 3], 9, -1)).toEqual([9, 1, 2, 3]);
  });
});
