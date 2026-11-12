import { addDays, parseIsoDate } from "./dates";
import { SCHEDULED_PLATFORM, isDone, planOf, type Game, type PlanId, type PlaySession, type Settings } from "./types";

export interface ScheduleRow {
  game: Game;
  /** 1-based number in the plan. */
  index: number;
  /** Hours this game takes in the plan (see `planHours`). */
  hours: number;
  weeks: number;
  /** Running sum of hours up to and including this game. */
  cumulativeHours: number;
  /** Start in UTC milliseconds; fractional days are kept. */
  startMs: number;
  /** End in UTC milliseconds; fractional days are kept. */
  endMs: number;
}

export interface ScheduleTotals {
  games: number;
  /** Remaining hours across the plan. */
  hours: number;
  /** Logged hours on planned games. */
  hoursPlayed: number;
  weeks: number;
  /** End of the last planned game, or null when the plan is empty. */
  endMs: number | null;
}

export interface Schedule {
  rows: ScheduleRow[];
  totals: ScheduleTotals;
}

export type ScheduleSettings = Pick<Settings, "startDate" | "hoursPerWeek">;

/** Hours a game still needs in the plan: the estimate minus what was logged, never below zero. */
export function planHours(game: Pick<Game, "casualHours" | "hoursPlayed">): number {
  return Math.max(0, game.casualHours - game.hoursPlayed);
}

/** Games still in a plan (not completed), in plan order; one plan (a platform's, or Together) or all of them. */
export function plannedGames(games: readonly Game[], plan?: PlanId): Game[] {
  return games
    .filter((game) => !isDone(game) && (plan === undefined || planOf(game) === plan))
    .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || a.id - b.id);
}

/** Finished games (completed or dropped) in finish order. */
export function completedGames(games: readonly Game[]): Game[] {
  return games
    .filter((game) => isDone(game))
    .sort((a, b) => (a.completedOrder ?? Infinity) - (b.completedOrder ?? Infinity) || a.id - b.id);
}

/**
 * Project start and end dates for every planned game on the scheduled
 * platform (PC), as the spreadsheet did, plus the time already played. Games
 * in the Together list are not part of it, nor are the hours logged on them:
 *
 *   weeks           = hours / hoursPerWeek
 *   cumulativeHours = running sum of hours
 *   elapsedHours    = hours logged on planned games since startDate
 *   end             = startDate + (elapsedHours + cumulativeHours) / hoursPerWeek * 7 days
 *   start           = previous game's end (first game starts on startDate)
 *
 * `hours` is what is left of each estimate. Hours played since the plan
 * started took calendar time too, so the rest of the plan starts after them;
 * without that, logging hours on the current game would pull its end back
 * towards the start date, into the past. Hours logged before the start only
 * shorten what is left.
 */
export function computeSchedule(games: readonly Game[], settings: ScheduleSettings, sessions: readonly PlaySession[] = []): Schedule {
  const { hoursPerWeek } = settings;
  if (!(hoursPerWeek > 0)) {
    throw new RangeError(`hoursPerWeek must be positive, got ${hoursPerWeek}`);
  }
  const startMs = parseIsoDate(settings.startDate);
  const planned = plannedGames(games, SCHEDULED_PLATFORM);
  const plannedIds = new Set(planned.map((game) => game.id));
  const elapsedHours = sessions
    .filter((session) => plannedIds.has(session.gameId) && session.playedOn >= settings.startDate)
    .reduce((sum, session) => sum + session.hours, 0);
  const originMs = addDays(startMs, (elapsedHours / hoursPerWeek) * 7);

  const rows: ScheduleRow[] = [];
  let cumulativeHours = 0;
  let hoursPlayed = 0;
  let previousEndMs = startMs;

  for (const game of planned) {
    const hours = planHours(game);
    cumulativeHours += hours;
    hoursPlayed += game.hoursPlayed;
    const endMs = addDays(originMs, (cumulativeHours / hoursPerWeek) * 7);
    rows.push({
      game,
      index: rows.length + 1,
      hours,
      weeks: hours / hoursPerWeek,
      cumulativeHours,
      startMs: previousEndMs,
      endMs,
    });
    previousEndMs = endMs;
  }

  return {
    rows,
    totals: {
      games: rows.length,
      hours: cumulativeHours,
      hoursPlayed,
      weeks: cumulativeHours / hoursPerWeek,
      endMs: rows.length > 0 ? previousEndMs : null,
    },
  };
}
