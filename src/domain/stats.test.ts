import { describe, expect, it } from "vitest";
import { buildSeedGames } from "./seed";
import { computeStats } from "./stats";
import type { Game, PlaySession } from "./types";

const now = new Date(2026, 10, 4); // 4 Nov 2026

describe("computeStats", () => {
  it("buckets finished games and logged hours by month, oldest first", () => {
    const games = buildSeedGames();
    const sessions: PlaySession[] = [
      { id: 1, gameId: 1, playedOn: "2026-11-02", hours: 2, note: null },
      { id: 2, gameId: 1, playedOn: "2026-11-03", hours: 3.5, note: null },
      { id: 3, gameId: 2, playedOn: "2026-09-10", hours: 4, note: null },
      { id: 4, gameId: 2, playedOn: "2025-01-10", hours: 100, note: null }, // outside the window
    ];
    const stats = computeStats(games, sessions, now);
    expect(stats.months).toHaveLength(12);
    expect(stats.months[0].month).toBe("2025-12");
    expect(stats.months[11]).toEqual({ month: "2026-11", finished: 1, hours: 5.5 }); // Ori, 01.11.2026
    expect(stats.months[10]).toEqual({ month: "2026-10", finished: 1, hours: 0 }); // God of War, 28.10.2026
    expect(stats.months[9]).toEqual({ month: "2026-09", finished: 0, hours: 4 });
    expect(stats.hoursLoggedTotal).toBe(109.5);
    expect(stats.finishedTotal).toBe(10);
    expect(stats.droppedTotal).toBe(0);
  });

  it("averages ratings overall and per type and genre, skipping unrated games", () => {
    const games: Game[] = buildSeedGames().map((g) => {
      if (g.title === "God of War (2018)") return { ...g, rating: 9 };
      if (g.title === "Far Cry 4") return { ...g, rating: 7 };
      if (g.title === "Far Cry 5") return { ...g, rating: 6 };
      if (g.title === "GTA 3") return { ...g, status: "dropped" };
      return g;
    });
    const stats = computeStats(games, [], now);
    expect(stats.finishedTotal).toBe(9);
    expect(stats.droppedTotal).toBe(1);
    expect(stats.ratedCount).toBe(3);
    expect(stats.avgRating).toBe(7.3);
    expect(stats.byType[0]).toEqual({ key: "open_world", count: 7, avgRating: 6.5 });
    expect(stats.byType[1]).toEqual({ key: "metroidvania", count: 1, avgRating: null });
    expect(stats.byType[2]).toEqual({ key: "semi_open", count: 1, avgRating: 9 });
    expect(stats.byGenre.find((g) => g.key === "shooter")).toEqual({ key: "shooter", count: 4, avgRating: 6.5 });
    expect(stats.byGenre.find((g) => g.key === "metroidvania")).toEqual({ key: "metroidvania", count: 1, avgRating: null });
  });

  it("handles an empty library", () => {
    const stats = computeStats([], [], now);
    expect(stats.months.every((m) => m.finished === 0 && m.hours === 0)).toBe(true);
    expect(stats.avgRating).toBeNull();
    expect(stats.byType).toEqual([]);
  });
});
