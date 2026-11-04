import { isGameSource, isGameStatus, isGameType, isGenre, isPlatform, type Game, type Platform } from "../domain/types";
import { getDb } from "./client";
import { lit, type SqlValue } from "./sql";
import type { CompletedDetails, GameInput, GamePatch } from "./repository";

interface GameRow {
  id: number;
  title: string;
  type: string;
  genre: string | null;
  platform: string;
  status: string;
  casual_hours: number;
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
}

const COLUMNS =
  "id, title, type, genre, platform, status, casual_hours, note, position, completed_order, completed_at, rating, review, " +
  "source, external_id, cover_url, release_date, provider_genres, provider_tags";

/** Next free finish-order number, evaluated inside the statement. */
const NEXT_COMPLETED_ORDER = "(SELECT COALESCE(MAX(completed_order), 0) + 1 FROM games)";

export async function listGames(): Promise<Game[]> {
  const db = await getDb();
  const rows = await db.select<GameRow[]>(`SELECT ${COLUMNS} FROM games ORDER BY platform, position, completed_order, id`);
  return rows.map(rowToGame);
}

/** SQL for inserting one game (without id). Used by the seed and add. */
export function insertGameStatement(game: Omit<Game, "id">): string {
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

function insertValues(id: number | null, game: Omit<Game, "id">, completedOrderSql: string): string {
  const columns = [
    "title", "type", "genre", "platform", "status", "casual_hours", "note", "position", "completed_order",
    "completed_at", "rating", "review", "source", "external_id", "cover_url", "release_date", "provider_genres", "provider_tags",
  ];
  const values = [
    lit(game.title),
    lit(game.type),
    lit(game.genre),
    lit(game.platform),
    lit(game.status),
    lit(game.casualHours),
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
  if (patch.status !== undefined) add("status", patch.status);
  if (patch.casualHours !== undefined) add("casual_hours", patch.casualHours);
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
  if (sets.length === 0) return null;
  values.push(id);
  return { sql: `UPDATE games SET ${sets.join(", ")} WHERE id = ?`, values };
}

export function deleteGameStatement(id: number): string {
  return `DELETE FROM games WHERE id = ${lit(id)}`;
}

export const DELETE_ALL_GAMES = "DELETE FROM games";

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
 * Statements that rewrite one platform's plan order inside a batch: clear
 * its planned positions first (the unique index allows NULLs), then assign
 * 1..n in the given order. Statuses are left alone.
 */
export function planOrderStatements(order: readonly number[], platform: Platform): string[] {
  return [resetPlanPositions(platform), ...order.map((id, index) => positionStatement(id, index + 1))];
}

export function resetPlanPositions(platform: Platform): string {
  return `UPDATE games SET position = NULL WHERE status NOT IN ('completed', 'dropped') AND platform = ${lit(platform)}`;
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
    status: row.status,
    casualHours: row.casual_hours,
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
