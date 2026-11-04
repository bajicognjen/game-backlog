import { describe, expect, it } from "vitest";
import { parseIsoDate } from "./dates";
import { computeSchedule } from "./schedule";
import { SEED_SETTINGS, buildSeedGames } from "./seed";
import { todayStatus } from "./today";

const settings = { startDate: SEED_SETTINGS.startDate, hoursPerWeek: SEED_SETTINGS.hoursPerWeek };
const on = (iso: string) => parseIsoDate(iso);

describe("todayStatus", () => {
  it("is on schedule while the current game is the expected one", () => {
    const status = todayStatus(computeSchedule(buildSeedGames(), settings), on("2026-11-04"));
    expect(status.expected?.game.title).toBe("Batman: Arkham Knight");
    expect(status.current?.game.title).toBe("Batman: Arkham Knight");
    expect(status.driftDays).toBe(0);
    expect(status.daysToCurrentEnd).toBe(11); // ends 15.11.2026
  });

  it("is behind when the plan expected the current game to be finished", () => {
    const status = todayStatus(computeSchedule(buildSeedGames(), settings), on("2026-11-20"));
    expect(status.expected?.game.title).toBe("Resident Evil 4 Remake");
    expect(status.driftDays).toBe(-5);
    expect(status.daysToCurrentEnd).toBe(-5);
  });

  it("is ahead when the current game is planned for later", () => {
    const games = buildSeedGames().map((g) =>
      g.title === "Batman: Arkham Knight" ? { ...g, status: "pending" as const } : g.title === "Assassin's Creed Shadows" ? { ...g, status: "in_progress" as const } : g,
    );
    const status = todayStatus(computeSchedule(games, settings), on("2026-11-10"));
    expect(status.expected?.game.title).toBe("Batman: Arkham Knight");
    expect(status.current?.game.title).toBe("Assassin's Creed Shadows");
    expect(status.driftDays).toBe(15); // Shadows starts 25.11.2026
  });

  it("handles days outside the plan and no current game", () => {
    const schedule = computeSchedule(buildSeedGames(), settings);
    expect(todayStatus(schedule, on("2026-10-01")).expected).toBeNull();
    const after = todayStatus(schedule, on("2028-04-01"));
    expect(after.expected).toBeNull();
    expect(after.driftDays).toBeLessThan(-100);

    const idle = buildSeedGames().map((g) => (g.status === "in_progress" ? { ...g, status: "pending" as const } : g));
    const none = todayStatus(computeSchedule(idle, settings), on("2026-11-04"));
    expect(none.current).toBeNull();
    expect(none.driftDays).toBeNull();
    expect(none.expected?.game.title).toBe("Batman: Arkham Knight");
  });
});
