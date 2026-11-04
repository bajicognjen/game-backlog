import type { PlaySession } from "../domain/types";
import { getDb } from "./client";
import { lit } from "./sql";

interface SessionRow {
  id: number;
  game_id: number;
  played_on: string;
  hours: number;
  note: string | null;
}

export interface SessionInput {
  gameId: number;
  playedOn: string;
  hours: number;
  note: string | null;
}

export async function listSessions(): Promise<PlaySession[]> {
  const db = await getDb();
  const rows = await db.select<SessionRow[]>("SELECT id, game_id, played_on, hours, note FROM play_sessions ORDER BY played_on, id");
  return rows.map((row) => ({ id: row.id, gameId: row.game_id, playedOn: row.played_on, hours: row.hours, note: row.note }));
}

export function insertSessionStatement(input: SessionInput): string {
  return `INSERT INTO play_sessions (game_id, played_on, hours, note) VALUES (${lit(input.gameId)}, ${lit(input.playedOn)}, ${lit(input.hours)}, ${lit(input.note)})`;
}

/** Restore a session from a backup, keeping its id. */
export function insertSessionWithIdStatement(session: PlaySession): string {
  return (
    "INSERT INTO play_sessions (id, game_id, played_on, hours, note) VALUES (" +
    [lit(session.id), lit(session.gameId), lit(session.playedOn), lit(session.hours), lit(session.note)].join(", ") +
    ")"
  );
}

export function deleteSessionStatement(id: number): string {
  return `DELETE FROM play_sessions WHERE id = ${lit(id)}`;
}

export function deleteSessionsOfGameStatement(gameId: number): string {
  return `DELETE FROM play_sessions WHERE game_id = ${lit(gameId)}`;
}

export const DELETE_ALL_SESSIONS = "DELETE FROM play_sessions";
