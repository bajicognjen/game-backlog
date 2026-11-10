import { isTauri } from "@tauri-apps/api/core";
import { createMemoryRepository } from "./memoryRepository";
import type { Repository } from "./repository";
import { sqliteRepository } from "./sqliteRepository";
import { createWebRepository } from "./webRepository";
import { hasIndexedDb } from "./webStorage";

/**
 * SQLite inside the Tauri app; IndexedDB in a browser (the web build and
 * `npm run dev`); an in-memory copy of the seed where there is neither
 * (the unit tests).
 */
export const repository: Repository = isTauri() ? sqliteRepository : hasIndexedDb() ? createWebRepository() : createMemoryRepository();

export type { SessionInput } from "./sessions";
export type {
  CompletedDetails,
  FinishInput,
  GameInput,
  GamePatch,
  PlanOrder,
  PlanOrderWithNew,
  Repository,
  Snapshot,
} from "./repository";
