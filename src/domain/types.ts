import type { GameDetails } from "./details";

export const GAME_TYPES = ["linear", "open_world", "giant", "relaxed", "medium"] as const;
export type GameType = (typeof GAME_TYPES)[number];

export const GAME_STATUSES = ["in_progress", "pending", "paused", "completed", "dropped"] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

/** Predefined genres; stored as codes, labelled in `i18n/sr.ts`. Extend here, no migration needed. */
export const GENRES = [
  "action",
  "action_adventure",
  "adventure",
  "rpg",
  "shooter",
  "platformer",
  "metroidvania",
  "puzzle",
  "horror",
  "survival",
  "stealth",
  "hack_and_slash",
  "soulslike",
  "roguelike",
  "narrative",
  "racing",
  "sports",
  "fighting",
  "strategy",
  "simulation",
  "other",
] as const;
export type Genre = (typeof GENRES)[number];

export const PLATFORMS = ["pc", "ps5", "ps4"] as const;
export type Platform = (typeof PLATFORMS)[number];

/** The one platform whose plan gets start and end dates from the weekly hours budget. */
export const SCHEDULED_PLATFORM: Platform = "pc";

/** Platforms with a plan tab. PS4 is history only: it shows up on finished games. */
export const PLAN_PLATFORMS: readonly Platform[] = ["pc", "ps5"];

export interface Game {
  id: number;
  title: string;
  type: GameType;
  genre: Genre | null;
  platform: Platform;
  /**
   * Set by the user: a game starts, pauses and resumes on request. Dates in
   * the PC plan follow the plan order, not the status.
   */
  status: GameStatus;
  /** Estimated casual playtime in hours. Only used for dates on the scheduled platform. */
  casualHours: number;
  /** Sum of logged sessions; the plan projects from `casualHours - hoursPlayed`. */
  hoursPlayed: number;
  /** Series the game belongs to (e.g. "GTA") and its number in it, for the order warning. */
  series: string | null;
  seriesOrder: number | null;
  note: string | null;
  /** Order in the plan (1-based); null once the game is completed. */
  position: number | null;
  /** Order in the completed list (1-based); null while the game is planned. */
  completedOrder: number | null;
  /** ISO date (YYYY-MM-DD); only for completed games, optional. */
  completedAt: string | null;
  /** 1–10; only for completed games, optional. */
  rating: number | null;
  review: string | null;
  /** Metadata cached from IGDB when the game was picked from search. */
  source: GameSource | null;
  /** The game's id at that source. */
  externalId: number | null;
  coverUrl: string | null;
  /** ISO date (YYYY-MM-DD). */
  releaseDate: string | null;
  /** Genre names as the source returned them (e.g. "Action", "RPG"). */
  providerGenres: string[];
  /** Descriptive tags normalised across sources (e.g. "Singleplayer", "Open World"). */
  providerTags: string[];
  /** Media, ratings, companies, store links and recommendations cached from IGDB; null until fetched. */
  details: GameDetails | null;
}

/** External game databases the app can search. One today; the provider layer allows more. */
export const GAME_SOURCES = ["igdb"] as const;
export type GameSource = (typeof GAME_SOURCES)[number];

export function isGameSource(value: string): value is GameSource {
  return (GAME_SOURCES as readonly string[]).includes(value);
}

/** One logged play session. */
export interface PlaySession {
  id: number;
  gameId: number;
  /** ISO date (YYYY-MM-DD). */
  playedOn: string;
  hours: number;
  note: string | null;
}

/** Statuses of games that left the plan: they live in the "finished" list. */
export const DONE_STATUSES: readonly GameStatus[] = ["completed", "dropped"];

export function isDone(game: Pick<Game, "status">): boolean {
  return DONE_STATUSES.includes(game.status);
}

export type Theme = "system" | "light" | "dark";

export interface Settings {
  /** ISO date (YYYY-MM-DD) on which the current game started. */
  startDate: string;
  /** Singleplayer hours per week. */
  hoursPerWeek: number;
  theme: Theme;
  /** IGDB credentials and the cached Twitch token. All kept local, never exported. */
  igdbClientId: string;
  igdbClientSecret: string;
  igdbAccessToken: string;
  /** Epoch milliseconds; 0 when there is no cached token. */
  igdbTokenExpiresAt: number;
}

export function isGameType(value: string): value is GameType {
  return (GAME_TYPES as readonly string[]).includes(value);
}

export function isGameStatus(value: string): value is GameStatus {
  return (GAME_STATUSES as readonly string[]).includes(value);
}

export function isPlatform(value: string): value is Platform {
  return (PLATFORMS as readonly string[]).includes(value);
}

export function isGenre(value: string): value is Genre {
  return (GENRES as readonly string[]).includes(value);
}
