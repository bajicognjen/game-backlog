import { toMetadata } from "../domain/provider";
import type { Game } from "../domain/types";
import { ProviderError } from "../platform/http";
import { providers } from "./providers";
import type { GameUpdate } from "./store";

/** Pause between games: each costs two IGDB requests, and IGDB allows four per second. */
const SPACING_MS = 600;
/** Wait before the one retry after IGDB answers 429 (too many requests). */
const RETRY_MS = 1500;

export interface DesignRefresh {
  /** One patch per refreshed game: its new metadata and the design derived from it. */
  updates: GameUpdate[];
  /** How many of them got a different design. */
  changed: number;
  /** Games IGDB could not be asked about (network trouble, missing record). */
  failed: number;
}

/**
 * Fetch fresh IGDB metadata (themes, genres, keywords, …) for every linked
 * game, one at a time, and derive each design from it. Nothing is written
 * here; the caller saves `updates`. Credential problems abort the whole run,
 * since every other game would fail the same way.
 */
export async function fetchDesignRefresh(games: readonly Game[], onProgress: (done: number, total: number) => void): Promise<DesignRefresh> {
  const linked = games.filter((g) => g.source === "igdb" && g.externalId !== null);
  const result: DesignRefresh = { updates: [], changed: 0, failed: 0 };
  for (const [index, game] of linked.entries()) {
    onProgress(index, linked.length);
    try {
      const meta = await detailsWithRetry(game.externalId as number);
      const type = meta.typeHint ?? game.type;
      if (type !== game.type) result.changed++;
      result.updates.push({ id: game.id, patch: { ...toMetadata(meta), type } });
    } catch (error) {
      if (error instanceof ProviderError && (error.reason === "no-credentials" || error.reason === "unauthorized")) throw error;
      result.failed++;
    }
    if (index < linked.length - 1) await sleep(SPACING_MS);
  }
  onProgress(linked.length, linked.length);
  return result;
}

async function detailsWithRetry(externalId: number) {
  try {
    return await providers.igdb.details(externalId);
  } catch (error) {
    if (!(error instanceof ProviderError && error.status === 429)) throw error;
    await sleep(RETRY_MS);
    return providers.igdb.details(externalId);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
