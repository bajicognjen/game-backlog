import { parseDetails } from "../domain/details";
import { TOGETHER, isGameSource, isGameStatus, isGameType, isGenre, isPlatform, type Game, type PlanId } from "../domain/types";
import { getDb } from "./client";
import { lit, type SqlValue } from "./sql";
import type { CompletedDetails, GameInput, GamePatch } from "./repository";

interface GameRow {
  id: number;
  title: string;
  type: string;
  genre: string | null;
  platform: string;
  together: number;
  status: string;
  casual_hours: number;
  hours_played: number;
  series: string | null;
  series_order: number | null;
  note: string | null;
  position: number | null;
  completed_order: number | null;
  completed_at: string | null;
  rating: number | null;
  review: string | null;
  source: string | null;
  external_id: number | null;
  cover_url: string | null;
  release_date: string | null;
  provider_genres: string;
  provider_tags: string;
  details: string | null;
}

const COLUMNS =
  "id, title, type, genre, platform, together, status, casual_hours, series, series_order, note, position, completed_order, completed_at, rating, review, " +
  "source, external_id, cover_url, release_date, provider_genres, provider_tags, details";

/** Next free finish-order number, evaluated inside the statement. */
const NEXT_COMPLETED_ORDER = "(SELECT COALESCE(MAX(completed_order), 0) + 1 FROM games)";

/** Logged hours per game, computed on read so the games table stays the single source of truth. */
const HOURS_PLAYED = "COALESCE((SELECT SUM(hours) FROM play_sessions WHERE play_sessions.game_id = games.id), 0) AS hours_played";

export async function listGames(): Promise<Game[]> {
  const db = await getDb();
  const rows = await db.select<GameRow[]>(
    `SELECT ${COLUMNS}, ${HOURS_PLAYED} FROM games ORDER BY platform, position, completed_order, id`,
  );
  return rows.map(rowToGame);
}

/** A game to insert: everything but the id and the derived hours played. */
export type NewGame = Omit<Game, "id" | "hoursPlayed">;

/** SQL for inserting one game (without id). Used by the seed and add. */
export function insertGameStatement(game: NewGame): string {
  return insertValues(null, game, lit(game.completedOrder));
}

/** SQL for restoring a game from a backup, keeping its id. */
export function insertGameWithIdStatement(game: Game): string {
  return insertValues(game.id, game, lit(game.completedOrder));
}

/** SQL for inserting a game straight into the completed list, at the end. */
export function insertCompletedGameStatement(input: GameInput & CompletedDetails): string {
  return insertValues(null, { ...input, status: "completed", position: null, completedOrder: null }, NEXT_COMPLETED_ORDER);
}

/** Move a planned game to the finished list as dropped (no rating required). */
export function dropGameStatement(id: number, droppedAt: string): string {
  return (
    "UPDATE games SET status = 'dropped', position = NULL, " +
    `completed_order = ${NEXT_COMPLETED_ORDER}, completed_at = ${lit(droppedAt)} ` +
    `WHERE id = ${lit(id)}`
  );
}

function insertValues(id: number | null, game: NewGame, completedOrderSql: string): string {
  const columns = [
    "title", "type", "genre", "platform", "together", "status", "casual_hours", "series", "series_order", "note", "position", "completed_order",
    "completed_at", "rating", "review", "source", "external_id", "cover_url", "release_date", "provider_genres", "provider_tags", "details",
  ];
  const values = [
    lit(game.title),
    lit(game.type),
    lit(game.genre),
    lit(game.platform),
    lit(game.together),
    lit(game.status),
    lit(game.casualHours),
    lit(game.series),
    lit(game.seriesOrder),
    lit(game.note),
    lit(game.position),
    completedOrderSql,
    lit(game.completedAt),
    lit(game.rating),
    lit(game.review),
    lit(game.source),
    lit(game.externalId),
    lit(game.coverUrl),
    lit(game.releaseDate),
    lit(JSON.stringify(game.providerGenres)),
    lit(JSON.stringify(game.providerTags)),
    lit(game.details ? JSON.stringify(game.details) : null),
  ];
  if (id !== null) {
    columns.unshift("id");
    values.unshift(lit(id));
  }
  return `INSERT INTO games (${columns.join(", ")}) VALUES (${values.join(", ")})`;
}

/** Bound UPDATE for the editable fields; null when the patch is empty. */
export function updateGameQuery(id: number, patch: GamePatch): { sql: string; values: SqlValue[] } | null {
  const sets: string[] = [];
  const values: SqlValue[] = [];
  const add = (column: string, value: SqlValue) => {
    values.push(value);
    sets.push(`${column} = ?`);
  };
  if (patch.title !== undefined) add("title", patch.title);
  if (patch.type !== undefined) add("type", patch.type);
  if (patch.genre !== undefined) add("genre", patch.genre);
  if (patch.platform !== undefined) add("platform", patch.platform);
  if (patch.together !== undefined) add("together", patch.together ? 1 : 0);
  // Cleared together with a move to another plan, so the old slot cannot collide there; the new plan's order sets it again.
  if (patch.position !== undefined) add("position", patch.position);
  if (patch.status !== undefined) add("status", patch.status);
  if (patch.casualHours !== undefined) add("casual_hours", patch.casualHours);
  if (patch.series !== undefined) add("series", patch.series);
  if (patch.seriesOrder !== undefined) add("series_order", patch.seriesOrder);
  if (patch.note !== undefined) add("note", patch.note);
  if (patch.completedAt !== undefined) add("completed_at", patch.completedAt);
  if (patch.rating !== undefined) add("rating", patch.rating);
  if (patch.review !== undefined) add("review", patch.review);
  if (patch.source !== undefined) add("source", patch.source);
  if (patch.externalId !== undefined) add("external_id", patch.externalId);
  if (patch.coverUrl !== undefined) add("cover_url", patch.coverUrl);
  if (patch.releaseDate !== undefined) add("release_date", patch.releaseDate);
  if (patch.providerGenres !== undefined) add("provider_genres", JSON.stringify(patch.providerGenres));
  if (patch.providerTags !== undefined) add("provider_tags", JSON.stringify(patch.providerTags));
  if (patch.details !== undefined) add("details", patch.details ? JSON.stringify(patch.details) : null);
  if (sets.length === 0) return null;
  values.push(id);
  return { sql: `UPDATE games SET ${sets.join(", ")} WHERE id = ?`, values };
}

export function deleteGameStatement(id: number): string {
  return `DELETE FROM games WHERE id = ${lit(id)}`;
}

export const DELETE_ALL_GAMES = "DELETE FROM games";

/** Put a game's status and finish fields back to a snapshot (undo of drop); orders are rewritten separately. */
export function restoreGameStatement(game: Game): string {
  return (
    `UPDATE games SET status = ${lit(game.status)}, position = NULL, completed_order = NULL, ` +
    `completed_at = ${lit(game.completedAt)}, rating = ${lit(game.rating)}, review = ${lit(game.review)} ` +
    `WHERE id = ${lit(game.id)}`
  );
}

/** Move a planned game to the end of the completed list. */
export function finishGameStatement(id: number, details: CompletedDetails): string {
  return (
    "UPDATE games SET status = 'completed', position = NULL, " +
    `completed_order = ${NEXT_COMPLETED_ORDER}, ` +
    `completed_at = ${lit(details.completedAt)}, rating = ${lit(details.rating)}, review = ${lit(details.review)} ` +
    `WHERE id = ${lit(id)}`
  );
}

/** Put a planned game in progress (the user pressed start, or the next game after a finish). */
export function startGameStatement(id: number): string {
  return `UPDATE games SET status = 'in_progress' WHERE id = ${lit(id)} AND status NOT IN ('completed', 'dropped')`;
}

/**
 * Statements that rewrite one plan's order inside a batch: clear its planned
 * positions first (the unique index allows NULLs), then assign 1..n in the
 * given order. Statuses are left alone.
 */
export function planOrderStatements(order: readonly number[], plan: PlanId): string[] {
  return [resetPlanPositions(plan), ...order.map((id, index) => positionStatement(id, index + 1))];
}

export function resetPlanPositions(plan: PlanId): string {
  return `UPDATE games SET position = NULL WHERE status NOT IN ('completed', 'dropped') AND ${inPlan(plan)}`;
}

/** The rows of one plan: the Together list spans platforms, a platform's plan holds its games not played together. */
function inPlan(plan: PlanId): string {
  return plan === TOGETHER ? "together = 1" : `together = 0 AND platform = ${lit(plan)}`;
}

export function positionStatement(id: number, position: number): string {
  return `UPDATE games SET position = ${lit(position)} WHERE id = ${lit(id)}`;
}

/** Statements that renumber the finish order 1..n in the given order, inside a batch. */
export function completedOrderStatements(order: readonly number[]): string[] {
  return [
    "UPDATE games SET completed_order = NULL WHERE status IN ('completed', 'dropped')",
    ...order.map((id, index) => `UPDATE games SET completed_order = ${lit(index + 1)} WHERE id = ${lit(id)}`),
  ];
}

function rowToGame(row: GameRow): Game {
  if (!isGameType(row.type)) throw new Error(`Unknown game type in database: ${row.type}`);
  if (!isGameStatus(row.status)) throw new Error(`Unknown game status in database: ${row.status}`);
  if (!isPlatform(row.platform)) throw new Error(`Unknown platform in database: ${row.platform}`);
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    // An unknown code (e.g. from a newer version) is shown as no genre rather than failing.
    genre: row.genre !== null && isGenre(row.genre) ? row.genre : null,
    platform: row.platform,
    together: row.together === 1,
    status: row.status,
    casualHours: row.casual_hours,
    hoursPlayed: row.hours_played ?? 0,
    series: row.series,
    seriesOrder: row.series_order,
    note: row.note,
    position: row.position,
    completedOrder: row.completed_order,
    completedAt: row.completed_at,
    rating: row.rating,
    review: row.review,
    // A row linked to a source the app no longer knows (RAWG) keeps its cached data but loses the link.
    source: row.source !== null && isGameSource(row.source) ? row.source : null,
    externalId: row.source !== null && isGameSource(row.source) ? row.external_id : null,
    coverUrl: row.cover_url,
    releaseDate: row.release_date,
    providerGenres: parseStringList(row.provider_genres),
    providerTags: parseStringList(row.provider_tags),
    details: parseDetails(row.details),
  };
}

function parseStringList(json: string | null): string[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}
