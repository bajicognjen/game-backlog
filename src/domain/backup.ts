import { isValidIsoDate } from "./dates";
import { withPlanOrder } from "./plan";
import { completedGames, plannedGames } from "./schedule";
import { GAME_STATUSES, GAME_TYPES, GENRES, PLATFORMS, isGameSource, type Game, type Settings, type Theme } from "./types";

/**
 * Bump when the file format changes. Older versions still import:
 *  1 — no platform field (everything is PC).
 *  2 — platform per game.
 *  3 — "paused" status; statuses are no longer derived from the plan order.
 *  4 — optional genre per game.
 *  5 — "dropped" status and RAWG metadata (rawgId, coverUrl, releaseDate, rawgGenres, rawgTags).
 *  6 — provider-neutral metadata (source, externalId, providerGenres, providerTags), gameSource setting.
 *  7 — IGDB is the only source; RAWG links from older files import as unlinked cached data.
 */
export const BACKUP_VERSION = 7;

export interface Backup {
  app: "game-backlog";
  version: number;
  exportedAt: string;
  settings: Settings;
  games: Game[];
}

export type BackupReason = "json" | "version" | "missing" | "type" | "enum" | "range" | "date" | "duplicate";

/** A validation failure with the JSON path that caused it (e.g. `games[3].rating`). */
export class BackupError extends Error {
  constructor(
    public readonly path: string,
    public readonly reason: BackupReason,
  ) {
    super(`${path}: ${reason}`);
    this.name = "BackupError";
  }
}

export function createBackup(games: readonly Game[], settings: Settings, now: Date = new Date()): Backup {
  return {
    app: "game-backlog",
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    // Credentials and tokens are local secrets and stay out of the file.
    settings: { ...settings, igdbClientId: "", igdbClientSecret: "", igdbAccessToken: "", igdbTokenExpiresAt: 0 },
    games: [...PLATFORMS.flatMap((platform) => plannedGames(games, platform)), ...completedGames(games)].map((game) => ({
      ...game,
    })),
  };
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2) + "\n";
}

/** File name for an export, e.g. `plan-igara-2026-11-04.json`. */
export function backupFileName(now: Date = new Date()): string {
  const iso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return `plan-igara-${iso}.json`;
}

/**
 * Parse and validate a backup file. Hard problems (wrong types, unknown enum
 * values, bad dates, duplicate ids) throw a `BackupError`. Soft ones are
 * normalised instead: positions are renumbered per platform in the stored
 * order and the finish order is renumbered. Statuses are kept as stored.
 */
export function parseBackup(text: string): Backup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("$", "json");
  }
  const root = expectObject(raw, "$");
  const version = root.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 1 || version > BACKUP_VERSION) {
    throw new BackupError("version", "version");
  }

  const settings = parseSettings(expectObject(root.settings, "settings"));
  const gamesRaw = root.games;
  if (!Array.isArray(gamesRaw)) throw new BackupError("games", "type");
  const games = gamesRaw.map((item, i) => parseGame(expectObject(item, `games[${i}]`), `games[${i}]`));

  const seen = new Set<number>();
  games.forEach((game, i) => {
    if (seen.has(game.id)) throw new BackupError(`games[${i}].id`, "duplicate");
    seen.add(game.id);
  });

  return {
    app: "game-backlog",
    version: BACKUP_VERSION,
    exportedAt: typeof root.exportedAt === "string" ? root.exportedAt : new Date(0).toISOString(),
    settings,
    games: normaliseGames(games),
  };
}

function normaliseGames(games: Game[]): Game[] {
  const completed = completedGames(games).map((game, i) => ({ ...game, position: null, completedOrder: i + 1 }));
  let renumbered = games.map((game) => (game.status === "completed" ? game : { ...game, completedOrder: null }));
  for (const platform of PLATFORMS) {
    renumbered = withPlanOrder(
      renumbered,
      plannedGames(games, platform).map((game) => game.id),
      platform,
    );
  }
  const byId = new Map(completed.map((game) => [game.id, game]));
  return renumbered.map((game) => byId.get(game.id) ?? game);
}

function parseSettings(obj: Record<string, unknown>): Settings {
  const startDate = obj.startDate;
  if (typeof startDate !== "string") throw new BackupError("settings.startDate", "type");
  if (!isValidIsoDate(startDate)) throw new BackupError("settings.startDate", "date");
  const hoursPerWeek = obj.hoursPerWeek;
  if (typeof hoursPerWeek !== "number" || !Number.isFinite(hoursPerWeek)) throw new BackupError("settings.hoursPerWeek", "type");
  if (hoursPerWeek <= 0) throw new BackupError("settings.hoursPerWeek", "range");
  const theme = obj.theme ?? "system";
  if (theme !== "system" && theme !== "light" && theme !== "dark") throw new BackupError("settings.theme", "enum");
  return {
    startDate,
    hoursPerWeek,
    theme: theme as Theme,
    igdbClientId: "",
    igdbClientSecret: "",
    igdbAccessToken: "",
    igdbTokenExpiresAt: 0,
  };
}

function parseGame(obj: Record<string, unknown>, path: string): Game {
  const id = obj.id;
  if (typeof id !== "number" || !Number.isInteger(id)) throw new BackupError(`${path}.id`, "type");
  if (id < 1) throw new BackupError(`${path}.id`, "range");

  const title = obj.title;
  if (typeof title !== "string") throw new BackupError(`${path}.title`, "type");
  if (title.trim() === "") throw new BackupError(`${path}.title`, "missing");

  const type = obj.type;
  if (typeof type !== "string") throw new BackupError(`${path}.type`, "type");
  if (!(GAME_TYPES as readonly string[]).includes(type)) throw new BackupError(`${path}.type`, "enum");

  const status = obj.status;
  if (typeof status !== "string") throw new BackupError(`${path}.status`, "type");
  if (!(GAME_STATUSES as readonly string[]).includes(status)) throw new BackupError(`${path}.status`, "enum");

  const genre = obj.genre ?? null;
  if (genre !== null && typeof genre !== "string") throw new BackupError(`${path}.genre`, "type");
  if (genre !== null && !(GENRES as readonly string[]).includes(genre)) throw new BackupError(`${path}.genre`, "enum");

  // Version 1 files have no platform: everything was PC.
  const platform = obj.platform ?? "pc";
  if (typeof platform !== "string") throw new BackupError(`${path}.platform`, "type");
  if (!(PLATFORMS as readonly string[]).includes(platform)) throw new BackupError(`${path}.platform`, "enum");

  const casualHours = obj.casualHours ?? 0;
  if (typeof casualHours !== "number" || !Number.isFinite(casualHours)) throw new BackupError(`${path}.casualHours`, "type");
  if (casualHours < 0) throw new BackupError(`${path}.casualHours`, "range");

  const rating = obj.rating ?? null;
  if (rating !== null && typeof rating !== "number") throw new BackupError(`${path}.rating`, "type");
  if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 10)) throw new BackupError(`${path}.rating`, "range");

  const completedAt = obj.completedAt ?? null;
  if (completedAt !== null && typeof completedAt !== "string") throw new BackupError(`${path}.completedAt`, "type");
  if (completedAt !== null && !isValidIsoDate(completedAt)) throw new BackupError(`${path}.completedAt`, "date");

  const releaseDate = obj.releaseDate ?? null;
  if (releaseDate !== null && typeof releaseDate !== "string") throw new BackupError(`${path}.releaseDate`, "type");
  if (releaseDate !== null && !isValidIsoDate(releaseDate)) throw new BackupError(`${path}.releaseDate`, "date");

  return {
    id,
    title: title.trim(),
    type: type as Game["type"],
    genre: genre as Game["genre"],
    platform: platform as Game["platform"],
    status: status as Game["status"],
    casualHours,
    note: optionalString(obj.note, `${path}.note`),
    position: optionalInteger(obj.position, `${path}.position`),
    completedOrder: optionalInteger(obj.completedOrder, `${path}.completedOrder`),
    completedAt,
    rating,
    review: optionalString(obj.review, `${path}.review`),
    ...parseMetadata(obj, path, releaseDate),
  };
}

/**
 * Versions 5 and 6 could carry RAWG links (`rawgId`, or `source: "rawg"`).
 * Their cached cover, date, genres and tags are kept; the link itself is
 * dropped, since the app no longer talks to RAWG.
 */
function parseMetadata(obj: Record<string, unknown>, path: string, releaseDate: string | null) {
  const legacy = obj.externalId === undefined && obj.rawgId !== undefined;
  const rawSource = obj.source ?? null;
  if (rawSource !== null && typeof rawSource !== "string") throw new BackupError(`${path}.source`, "type");
  const linked = rawSource !== null && isGameSource(rawSource);
  const externalId = linked ? optionalInteger(obj.externalId, `${path}.externalId`) : null;
  return {
    source: (linked && externalId !== null ? rawSource : null) as Game["source"],
    externalId: linked ? externalId : null,
    coverUrl: optionalString(obj.coverUrl, `${path}.coverUrl`),
    releaseDate,
    providerGenres: stringList(legacy ? obj.rawgGenres : obj.providerGenres, `${path}.providerGenres`),
    providerTags: stringList(legacy ? obj.rawgTags : obj.providerTags, `${path}.providerTags`),
  };
}

function stringList(value: unknown, path: string): string[] {
  if (value === null || value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) throw new BackupError(path, "type");
  return value as string[];
}

function expectObject(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new BackupError(path, "type");
  return value as Record<string, unknown>;
}

function optionalString(value: unknown, path: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new BackupError(path, "type");
  return value.trim() === "" ? null : value;
}

function optionalInteger(value: unknown, path: string): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "number" || !Number.isInteger(value)) throw new BackupError(path, "type");
  return value;
}
