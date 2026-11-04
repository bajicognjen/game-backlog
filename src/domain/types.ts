export const GAME_TYPES = ["linear", "open_world", "giant", "relaxed", "medium"] as const;
export type GameType = (typeof GAME_TYPES)[number];

export const GAME_STATUSES = ["in_progress", "pending", "paused", "completed"] as const;
export type GameStatus = (typeof GAME_STATUSES)[number];

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
  platform: Platform;
  /**
   * Set by the user: a game starts, pauses and resumes on request. Dates in
   * the PC plan follow the plan order, not the status.
   */
  status: GameStatus;
  /** Estimated casual playtime in hours. Only used for dates on the scheduled platform. */
  casualHours: number;
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
}

export type Theme = "system" | "light" | "dark";

export interface Settings {
  /** ISO date (YYYY-MM-DD) on which the current game started. */
  startDate: string;
  /** Singleplayer hours per week. */
  hoursPerWeek: number;
  theme: Theme;
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
