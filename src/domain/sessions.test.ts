import { describe, expect, it } from "vitest";
import { buildSeedGames } from "./seed";
import { hoursPlayedOf, progressOf, sessionsOf, withHoursPlayed } from "./sessions";
import type { PlaySession } from "./types";

const sessions: PlaySession[] = [
  { id: 1, gameId: 1, playedOn: "2026-11-02", hours: 2.5, note: null },
  { id: 2, gameId: 1, playedOn: "2026-11-04", hours: 3, note: "boss" },
  { id: 3, gameId: 2, playedOn: "2026-11-03", hours: 1, note: null },
];

describe("sessions", () => {
  it("sums hours per game and recomputes hoursPlayed", () => {
    expect(hoursPlayedOf(sessions, 1)).toBe(5.5);
    expect(hoursPlayedOf(sessions, 3)).toBe(0);
    const games = withHoursPlayed(buildSeedGames(), sessions);
    expect(games[0].hoursPlayed).toBe(5.5);
    expect(games[1].hoursPlayed).toBe(1);
    expect(games[2].hoursPlayed).toBe(0);
  });

  it("lists a game's sessions newest first", () => {
    expect(sessionsOf(sessions, 1).map((s) => s.id)).toEqual([2, 1]);
  });

  it("reports progress against the estimate, capped at 1", () => {
    expect(progressOf({ casualHours: 25, hoursPlayed: 12.5 })).toBe(0.5);
    expect(progressOf({ casualHours: 10, hoursPlayed: 30 })).toBe(1);
    expect(progressOf({ casualHours: 0, hoursPlayed: 3 })).toBeNull();
  });
});
