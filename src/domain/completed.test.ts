import { describe, expect, it } from "vitest";
import { isValidRating, sortCompleted } from "./completed";
import { NO_METADATA } from "./seed";
import type { Game } from "./types";

function done(id: number, order: number, completedAt: string | null, rating: number | null): Game {
  return {
    id,
    title: `Game ${id}`,
    type: "linear",
    genre: null,
    platform: "pc",
    status: "completed",
    casualHours: 0,
    note: null,
    position: null,
    completedOrder: order,
    completedAt,
    rating,
    review: null,
    ...NO_METADATA,
  };
}

const games: Game[] = [
  done(1, 1, null, null),
  done(2, 2, "2026-10-28", 9),
  done(3, 3, "2026-11-01", 7),
  done(4, 4, "2026-09-15", null),
  { ...done(5, 5, "2026-12-01", 10), status: "pending", position: 1, completedOrder: null },
];

describe("sortCompleted", () => {
  it("ignores games that are not completed", () => {
    expect(sortCompleted(games, "order", "asc").map((g) => g.id)).toEqual([1, 2, 3, 4]);
  });

  it("sorts by finish order in both directions", () => {
    expect(sortCompleted(games, "order", "desc").map((g) => g.id)).toEqual([4, 3, 2, 1]);
  });

  it("sorts by date with undated games last either way", () => {
    expect(sortCompleted(games, "date", "desc").map((g) => g.id)).toEqual([3, 2, 4, 1]);
    expect(sortCompleted(games, "date", "asc").map((g) => g.id)).toEqual([4, 2, 3, 1]);
  });

  it("sorts by rating with unrated games last, ties by finish order", () => {
    expect(sortCompleted(games, "rating", "desc").map((g) => g.id)).toEqual([2, 3, 1, 4]);
    expect(sortCompleted(games, "rating", "asc").map((g) => g.id)).toEqual([3, 2, 1, 4]);
  });

  it("does not mutate the input", () => {
    const before = games.map((g) => g.id);
    sortCompleted(games, "rating", "desc");
    expect(games.map((g) => g.id)).toEqual(before);
  });
});

describe("isValidRating", () => {
  it("accepts null and whole numbers from 1 to 10", () => {
    expect(isValidRating(null)).toBe(true);
    expect(isValidRating(1)).toBe(true);
    expect(isValidRating(10)).toBe(true);
    expect(isValidRating(0)).toBe(false);
    expect(isValidRating(11)).toBe(false);
    expect(isValidRating(7.5)).toBe(false);
  });
});
