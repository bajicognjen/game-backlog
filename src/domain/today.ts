import { MS_PER_DAY, floorToDay } from "./dates";
import type { Schedule, ScheduleRow } from "./schedule";

/** Where today falls in the PC plan, and how the current game compares to it. */
export interface TodayStatus {
  /** The row whose span contains today; null before the plan starts or after it ends. */
  expected: ScheduleRow | null;
  /** The row of the game in progress; null when none is. */
  current: ScheduleRow | null;
  /**
   * Whole days ahead of plan (positive) or behind (negative); 0 when the
   * current game is the expected one. Null without a current game or a plan.
   */
  driftDays: number | null;
  /** Whole days from today to the current game's planned end; negative when overdue. */
  daysToCurrentEnd: number | null;
}

export function todayStatus(schedule: Schedule, todayMs: number): TodayStatus {
  const today = floorToDay(todayMs);
  const { rows } = schedule;
  const expected = rows.find((row) => today >= floorToDay(row.startMs) && today < floorToDay(row.endMs)) ?? null;
  const current = rows.find((row) => row.game.status === "in_progress") ?? null;

  if (!current || rows.length === 0) {
    return { expected, current, driftDays: null, daysToCurrentEnd: null };
  }

  const daysToCurrentEnd = days(floorToDay(current.endMs) - today);
  let driftDays: number;
  if (expected?.game.id === current.game.id) {
    driftDays = 0;
  } else if (today < floorToDay(current.startMs)) {
    driftDays = days(floorToDay(current.startMs) - today); // playing something the plan puts later
  } else {
    driftDays = -days(today - floorToDay(current.endMs)); // the plan expected this game finished by now
  }
  return { expected, current, driftDays, daysToCurrentEnd };
}

function days(ms: number): number {
  return Math.round(ms / MS_PER_DAY);
}
