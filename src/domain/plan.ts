import { completedGames, plannedGames } from "./schedule";
import { isDone, planOf, type Game, type PlanId } from "./types";

/**
 * Plan-order rules shared by the UI, the store and the storage layer. Each
 * platform has its own plan, and games played with others share the Together
 * list (see `planOf`):
 *
 *  - positions are 1-based and contiguous in the given order;
 *  - statuses are never touched: the user starts, pauses and finishes games;
 *  - completed games and other plans' games are never touched.
 */
export function withPlanOrder(games: readonly Game[], order: readonly number[], plan: PlanId): Game[] {
  const indexById = new Map(order.map((id, index) => [id, index]));
  return games.map((game) => {
    if (isDone(game) || planOf(game) !== plan) return game;
    const index = indexById.get(game.id);
    if (index === undefined) throw new Error(`Game ${game.id} is missing from the ${plan} plan order`);
    return { ...game, position: index + 1 };
  });
}

/** Ids of the completed games in finish order. */
export function completedIds(games: readonly Game[]): number[] {
  return completedGames(games).map((game) => game.id);
}

/** Renumber the finish order 1..n in the given order; other games untouched. */
export function withCompletedOrder(games: readonly Game[], order: readonly number[]): Game[] {
  const indexById = new Map(order.map((id, index) => [id, index]));
  return games.map((game) => {
    if (!isDone(game)) return game;
    const index = indexById.get(game.id);
    if (index === undefined) throw new Error(`Game ${game.id} is missing from the completed order`);
    return { ...game, completedOrder: index + 1 };
  });
}

/** Ids of one plan's games in plan order. */
export function plannedIds(games: readonly Game[], plan: PlanId): number[] {
  return plannedGames(games, plan).map((game) => game.id);
}

/** Move the item at `from` to `to`, like dnd-kit's arrayMove. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const result = items.slice();
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

/** Insert `item` so that it ends up at 0-based `index` (clamped to the ends). */
export function insertAt<T>(items: readonly T[], item: T, index: number): T[] {
  const result = items.slice();
  result.splice(Math.max(0, Math.min(index, result.length)), 0, item);
  return result;
}
