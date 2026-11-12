import type { Backup } from "../domain/backup";
import type { GameDetails } from "../domain/details";
import type { Game, GameSource, GameStatus, GameType, Genre, PlanId, Platform, PlaySession, Settings } from "../domain/types";
import type { SessionInput } from "./sessions";

export interface Snapshot {
  games: Game[];
  settings: Settings;
  sessions: PlaySession[];
}

/** The editable fields every game has. */
export interface GameInput {
  title: string;
  type: GameType;
  genre: Genre | null;
  platform: Platform;
  /** Played with others: planned in the Together list, outside the PC schedule. */
  together: boolean;
  casualHours: number;
  series: string | null;
  seriesOrder: number | null;
  note: string | null;
  source: GameSource | null;
  externalId: number | null;
  coverUrl: string | null;
  releaseDate: string | null;
  providerGenres: string[];
  providerTags: string[];
  details: GameDetails | null;
}

/** The fields only completed games carry. */
export interface CompletedDetails {
  /** ISO date (YYYY-MM-DD) or null when unknown. */
  completedAt: string | null;
  /** 1–10 or null when not rated yet. */
  rating: number | null;
  review: string | null;
}

/** `position: null` goes with a change of plan (platform or together): the game leaves its old slot before it gets a new one. */
export type GamePatch = Partial<GameInput & CompletedDetails & { status: GameStatus; position: null }>;

/** What the finish-game dialog collects. */
export interface FinishInput extends CompletedDetails {
  completedAt: string;
  /** New `startDate` setting; null for platforms without a schedule. */
  nextStartDate: string | null;
  /** Put the first remaining game of that plan in progress. */
  startNext: boolean;
}

/** The complete order of one plan's games (a platform's plan, or Together). */
export interface PlanOrder {
  plan: PlanId;
  ids: readonly number[];
}

/** Like `PlanOrder`, with one `"new"` slot for the game being added. */
export interface PlanOrderWithNew {
  plan: PlanId;
  ids: ReadonlyArray<number | "new">;
}

/**
 * Everything the UI needs from storage. The real implementation talks to
 * SQLite through tauri-plugin-sql; a memory implementation backs the plain
 * browser preview (`npm run dev` outside Tauri) and keeps the UI testable.
 *
 * Every write that touches a plan takes that plan's complete new order
 * of game ids, so positions are always rewritten contiguously and the first
 * planned game is marked in progress (see `domain/plan.ts`).
 */
export interface Repository {
  load(): Promise<Snapshot>;
  saveSettings(patch: Partial<Settings>): Promise<void>;
  addPlannedGame(input: GameInput, order: PlanOrderWithNew): Promise<void>;
  addCompletedGame(input: GameInput & CompletedDetails): Promise<void>;
  updateGame(id: number, patch: GamePatch): Promise<void>;
  deleteGame(id: number, planOrder: PlanOrder): Promise<void>;
  setPlanOrder(planOrder: PlanOrder): Promise<void>;
  /** Mark `id` completed (next finish order), reorder its plan, optionally move `startDate` and start the next game. */
  finishGame(id: number, input: FinishInput, planOrder: PlanOrder): Promise<void>;
  /** Renumber the finish order of all finished games. */
  setCompletedOrder(ids: readonly number[]): Promise<void>;
  /** Give up on a planned game: it leaves the plan and joins the finished list as dropped. */
  dropGame(id: number, droppedAt: string, planOrder: PlanOrder): Promise<void>;
  /** Log hours on a game. */
  addSession(input: SessionInput): Promise<void>;
  deleteSession(id: number): Promise<void>;
  /** Log several sessions in one write (the Steam import). */
  addSessions(inputs: readonly SessionInput[]): Promise<void>;
  /** Remove several sessions in one write (undo of an import). */
  deleteSessions(ids: readonly number[]): Promise<void>;
  /** Undo of delete: put the game and its sessions back with their ids, then rewrite the orders. */
  reinsertGame(game: Game, sessions: readonly PlaySession[], planOrder: PlanOrder | null, completedOrder: readonly number[] | null): Promise<void>;
  /** Undo of drop: the game exists; reset its status and finish fields, then rewrite the orders. */
  restoreGame(game: Game, planOrder: PlanOrder | null, completedOrder: readonly number[] | null): Promise<void>;
  /** Replace every game and setting with the contents of a backup, atomically. */
  replaceAll(backup: Backup): Promise<void>;
}
