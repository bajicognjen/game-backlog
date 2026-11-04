import type { Game, PlaySession } from "./types";

/** Sum of a game's sessions. */
export function hoursPlayedOf(sessions: readonly PlaySession[], gameId: number): number {
  return sessions.filter((s) => s.gameId === gameId).reduce((sum, s) => sum + s.hours, 0);
}

/** Games with `hoursPlayed` recomputed from the sessions (for the memory repository and imports). */
export function withHoursPlayed(games: readonly Game[], sessions: readonly PlaySession[]): Game[] {
  const sums = new Map<number, number>();
  for (const session of sessions) sums.set(session.gameId, (sums.get(session.gameId) ?? 0) + session.hours);
  return games.map((game) => ({ ...game, hoursPlayed: sums.get(game.id) ?? 0 }));
}

/** Sessions of one game, newest first. */
export function sessionsOf(sessions: readonly PlaySession[], gameId: number): PlaySession[] {
  return sessions
    .filter((s) => s.gameId === gameId)
    .sort((a, b) => b.playedOn.localeCompare(a.playedOn) || b.id - a.id);
}

/** 0–1 share of the estimate already played; null when there is no estimate. */
export function progressOf(game: Pick<Game, "casualHours" | "hoursPlayed">): number | null {
  if (game.casualHours <= 0) return null;
  return Math.min(1, game.hoursPlayed / game.casualHours);
}
