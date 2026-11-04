import { describe, expect, it } from "vitest";
import { MS_PER_DAY, formatDate, parseIsoDate } from "./dates";
import { completedGames, computeSchedule, plannedGames } from "./schedule";
import { SEED_SETTINGS, buildSeedGames } from "./seed";
import type { Game } from "./types";

const settings = { startDate: SEED_SETTINGS.startDate, hoursPerWeek: SEED_SETTINGS.hoursPerWeek };

function game(overrides: Partial<Game> & Pick<Game, "id" | "casualHours">): Game {
  return {
    title: `Game ${overrides.id}`,
    type: "linear",
    platform: "pc",
    status: "pending",
    note: null,
    position: overrides.id,
    completedOrder: null,
    completedAt: null,
    rating: null,
    review: null,
    ...overrides,
  };
}

describe("acceptance check with the seed data", () => {
  const schedule = computeSchedule(buildSeedGames(), settings);
  const byTitle = (title: string) => {
    const row = schedule.rows.find((r) => r.game.title === title);
    if (!row) throw new Error(`missing row ${title}`);
    return row;
  };

  it("plans 27 games and keeps 10 completed ones aside", () => {
    expect(schedule.rows).toHaveLength(27);
    expect(completedGames(buildSeedGames())).toHaveLength(10);
  });

  it("Batman: Arkham Knight starts 02.11.2026 and ends 15.11.2026", () => {
    const row = byTitle("Batman: Arkham Knight");
    expect(row.index).toBe(1);
    expect(formatDate(row.startMs)).toBe("02.11.2026");
    expect(formatDate(row.endMs)).toBe("15.11.2026");
  });

  it("Assassin's Creed Shadows runs 25.11.2026 → 24.12.2026", () => {
    const row = byTitle("Assassin's Creed Shadows");
    expect(row.index).toBe(3);
    expect(formatDate(row.startMs)).toBe("25.11.2026");
    expect(formatDate(row.endMs)).toBe("24.12.2026");
  });

  it("totals 901 hours, 69.3 weeks, last game ends 01.03.2028", () => {
    expect(schedule.totals.hours).toBe(901);
    expect(schedule.totals.weeks.toFixed(1)).toBe("69.3");
    expect(schedule.totals.games).toBe(27);
    expect(formatDate(schedule.totals.endMs!)).toBe("01.03.2028");
    expect(formatDate(byTitle("Skyrim").endMs)).toBe("01.03.2028");
  });
});

describe("schedule rules", () => {
  it("starts the first game on startDate and each next one when the previous ends", () => {
    const { rows } = computeSchedule(buildSeedGames(), settings);
    expect(rows[0].startMs).toBe(parseIsoDate(settings.startDate));
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].startMs).toBe(rows[i - 1].endMs);
    }
  });

  it("computes weeks, cumulative hours and end exactly like the sheet", () => {
    const { rows } = computeSchedule(buildSeedGames(), settings);
    const start = parseIsoDate(settings.startDate);
    let cumulative = 0;
    for (const row of rows) {
      cumulative += row.game.casualHours;
      expect(row.hours).toBe(row.game.casualHours);
      expect(row.weeks).toBe(row.game.casualHours / 13);
      expect(row.cumulativeHours).toBe(cumulative);
      expect(row.endMs).toBe(start + (cumulative / 13) * 7 * MS_PER_DAY);
    }
  });

  it("keeps fractional days internally and floors only for display", () => {
    const { rows } = computeSchedule(buildSeedGames(), settings);
    const batman = rows[0];
    const days = (batman.endMs - batman.startMs) / MS_PER_DAY;
    expect(days).toBeCloseTo(13.4615, 4);
    expect(formatDate(batman.endMs)).toBe("15.11.2026");
  });

  it("ignores completed games and follows position, not array order", () => {
    const games = [
      game({ id: 1, casualHours: 10, position: 2 }),
      game({ id: 2, casualHours: 20, position: 1, status: "in_progress" }),
      game({ id: 3, casualHours: 99, position: null, status: "completed", completedOrder: 1 }),
    ];
    const { rows, totals } = computeSchedule(games, { startDate: "2026-01-01", hoursPerWeek: 10 });
    expect(rows.map((r) => r.game.id)).toEqual([2, 1]);
    expect(rows.map((r) => r.index)).toEqual([1, 2]);
    expect(totals.hours).toBe(30);
    expect(plannedGames(games).map((g) => g.id)).toEqual([2, 1]);
  });

  it("schedules only the PC plan; PS5 games are a plain queue", () => {
    const games = [
      game({ id: 1, casualHours: 10, position: 1, status: "in_progress" }),
      game({ id: 2, casualHours: 50, position: 1, status: "in_progress", platform: "ps5" }),
      game({ id: 3, casualHours: 20, position: 2 }),
    ];
    const { rows, totals } = computeSchedule(games, { startDate: "2026-01-01", hoursPerWeek: 10 });
    expect(rows.map((r) => r.game.id)).toEqual([1, 3]);
    expect(totals.hours).toBe(30);
    expect(plannedGames(games, "ps5").map((g) => g.id)).toEqual([2]);
    expect(plannedGames(games).map((g) => g.id)).toEqual([1, 2, 3]);
  });

  it("recalculates when the weekly budget changes", () => {
    const fast = computeSchedule(buildSeedGames(), { ...settings, hoursPerWeek: 25 });
    expect(formatDate(fast.rows[0].endMs)).toBe("09.11.2026"); // 25 h / 25 h per week = 7 days
    expect(fast.totals.weeks).toBeCloseTo(901 / 25, 10);
  });

  it("handles an empty plan", () => {
    const { rows, totals } = computeSchedule([], settings);
    expect(rows).toEqual([]);
    expect(totals).toEqual({ games: 0, hours: 0, weeks: 0, endMs: null });
  });

  it("rejects a non-positive weekly budget", () => {
    expect(() => computeSchedule([], { ...settings, hoursPerWeek: 0 })).toThrow(RangeError);
    expect(() => computeSchedule([], { ...settings, hoursPerWeek: -5 })).toThrow(RangeError);
  });
});
