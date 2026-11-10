import type { Repository } from "./repository";
import { createSnapshotRepository } from "./snapshotRepository";

/**
 * Throwaway repository for the unit tests (and any browser without
 * IndexedDB): starts from the seed data and forgets everything on reload.
 */
export function createMemoryRepository(): Repository {
  return createSnapshotRepository();
}
