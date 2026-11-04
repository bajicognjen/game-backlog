import { addDays, parseIsoDate } from "./dates";
import { SCHEDULED_PLATFORM, type Game, type Platform, type Settings } from "./types";

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
  hours: number;
  weeks: number;
  /** End of the last planned game, or null when the plan is empty. */
  endMs: number | null;
}

export interface Schedule {
  rows: ScheduleRow[];
  totals: ScheduleTotals;
}

export type ScheduleSettings = Pick<Settings, "startDate" | "hoursPerWeek">;

/**
 * Hours a game still needs in the plan. Today that is the full casual
 * estimate; once played hours are logged this becomes the remaining estimate,
 * and nothing else in the schedule has to change.
 */
export function planHours(game: Pick<Game, "casualHours">): number {
  return game.casualHours;
}

/** Games still in a plan (not completed), in plan order; one platform or all of them. */
export function plannedGames(games: readonly Game[], platform?: Platform): Game[] {
  return games
    .filter((game) => game.status !== "completed" && (platform === undefined || game.platform === platform))
    .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity) || a.id - b.id);
}

/** Completed games in finish order. */
export function completedGames(games: readonly Game[]): Game[] {
  return games
    .filter((game) => game.status === "completed")
    .sort((a, b) => (a.completedOrder ?? Infinity) - (b.completedOrder ?? Infinity) || a.id - b.id);
}

/**
 * Project start and end dates for every planned game on the scheduled
 * platform (PC), matching the spreadsheet exactly:
 *
 *   weeks           = hours / hoursPerWeek
 *   cumulativeHours = running sum of hours
 *   end             = startDate + cumulativeHours / hoursPerWeek * 7 days
 *   start           = previous game's end (first game starts on startDate)
 */
export function computeSchedule(games: readonly Game[], settings: ScheduleSettings): Schedule {
  const { hoursPerWeek } = settings;
  if (!(hoursPerWeek > 0)) {
    throw new RangeError(`hoursPerWeek must be positive, got ${hoursPerWeek}`);
  }
  const startMs = parseIsoDate(settings.startDate);

  const rows: ScheduleRow[] = [];
  let cumulativeHours = 0;
  let previousEndMs = startMs;

  for (const game of plannedGames(games, SCHEDULED_PLATFORM)) {
    const hours = planHours(game);
    cumulativeHours += hours;
    const endMs = addDays(startMs, (cumulativeHours / hoursPerWeek) * 7);
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
      weeks: cumulativeHours / hoursPerWeek,
      endMs: rows.length > 0 ? previousEndMs : null,
    },
  };
}
