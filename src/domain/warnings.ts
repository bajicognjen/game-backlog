import type { Game } from "./types";

/** Estimated hours from which a game counts as long; two in a row get flagged. */
export const LONG_GAME_HOURS = 50;

/** Problems in a plan order worth flagging; each points at the row it belongs to. */
export type PlanWarning =
  | { kind: "adjacent_long"; gameId: number; previousTitle: string }
  | { kind: "series_order"; gameId: number; series: string; afterTitle: string };

/**
 * Check one platform's planned games in plan order:
 *  - two long games (50 h or more) back to back (flagged on the second);
 *  - a series entry placed after a later entry of the same series (flagged on the earlier entry).
 * Finished games are not part of the order, so they never trigger anything.
 */
export function planWarnings(planned: readonly Game[]): PlanWarning[] {
  const warnings: PlanWarning[] = [];
  const latestInSeries = new Map<string, { order: number; title: string }>();

  planned.forEach((game, index) => {
    const previous = planned[index - 1];
    if (previous && game.casualHours >= LONG_GAME_HOURS && previous.casualHours >= LONG_GAME_HOURS) {
      warnings.push({ kind: "adjacent_long", gameId: game.id, previousTitle: previous.title });
    }

    if (game.series && game.seriesOrder !== null) {
      const key = game.series.trim().toLowerCase();
      const latest = latestInSeries.get(key);
      if (latest && game.seriesOrder < latest.order) {
        warnings.push({ kind: "series_order", gameId: game.id, series: game.series, afterTitle: latest.title });
      }
      if (!latest || game.seriesOrder > latest.order) {
        latestInSeries.set(key, { order: game.seriesOrder, title: game.title });
      }
    }
  });

  return warnings;
}

/** Distinct series names in use, for the dialog's suggestions. */
export function seriesNames(games: readonly Game[]): string[] {
  return Array.from(new Set(games.map((g) => g.series).filter((s): s is string => !!s))).sort((a, b) => a.localeCompare(b));
}
