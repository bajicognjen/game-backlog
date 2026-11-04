import { isTauri } from "@tauri-apps/api/core";
import { createMemoryRepository } from "./memoryRepository";
import type { Repository } from "./repository";
import { sqliteRepository } from "./sqliteRepository";

/** SQLite inside the Tauri app; an in-memory copy of the seed in a plain browser. */
export const repository: Repository = isTauri() ? sqliteRepository : createMemoryRepository();

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
