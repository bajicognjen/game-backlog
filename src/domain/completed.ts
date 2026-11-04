import { isDone, type Game } from "./types";

export type CompletedSortKey = "order" | "date" | "rating";
export type SortDirection = "asc" | "desc";

/** The direction that reads naturally when a key is first chosen. */
export const DEFAULT_SORT_DIRECTION: Record<CompletedSortKey, SortDirection> = {
  order: "asc",
  date: "desc",
  rating: "desc",
};

/**
 * Sort completed games. Games without a date or rating always go last,
 * whatever the direction; ties fall back to finish order.
 */
export function sortCompleted(games: readonly Game[], key: CompletedSortKey, direction: SortDirection): Game[] {
  const sign = direction === "asc" ? 1 : -1;
  return games
    .filter((game) => isDone(game))
    .slice()
    .sort((a, b) => {
      if (key === "order") return sign * byOrder(a, b);
      const left = key === "date" ? a.completedAt : a.rating;
      const right = key === "date" ? b.completedAt : b.rating;
      if (left === null && right === null) return byOrder(a, b);
      if (left === null) return 1;
      if (right === null) return -1;
      const cmp = typeof left === "string" ? left.localeCompare(right as string) : left - (right as number);
      return cmp !== 0 ? sign * cmp : byOrder(a, b);
    });
}

function byOrder(a: Game, b: Game): number {
  return (a.completedOrder ?? Infinity) - (b.completedOrder ?? Infinity) || a.id - b.id;
}

export function isValidRating(value: number | null): boolean {
  return value === null || (Number.isInteger(value) && value >= 1 && value <= 10);
}
