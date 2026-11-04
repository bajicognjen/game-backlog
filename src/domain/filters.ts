import { TAG_COOP, TAG_MULTIPLAYER, TAG_SINGLEPLAYER } from "./provider";
import type { Game } from "./types";

/** The game modes a user can filter by; matched against the normalised provider tags. */
export const MODE_FILTERS = [TAG_SINGLEPLAYER, TAG_MULTIPLAYER, TAG_COOP] as const;
export type ModeFilter = (typeof MODE_FILTERS)[number];

export interface GameFilter {
  /** Any of these modes must be present; empty means no mode filter. */
  modes: ModeFilter[];
  /** One of IGDB's platform names (from the cached details); null means any. */
  platform: string | null;
}

export const NO_FILTER: GameFilter = { modes: [], platform: null };

export function isFilterActive(filter: GameFilter): boolean {
  return filter.modes.length > 0 || filter.platform !== null;
}

/** A game passes when it has at least one selected mode and, if asked, lists the platform. */
export function matchesFilter(game: Game, filter: GameFilter): boolean {
  if (filter.modes.length > 0 && !filter.modes.some((mode) => game.providerTags.includes(mode))) return false;
  if (filter.platform !== null && !(game.details?.platforms ?? []).includes(filter.platform)) return false;
  return true;
}

/** Every platform name the library knows, for the platform dropdown. */
export function availablePlatforms(games: readonly Game[]): string[] {
  const names = new Set<string>();
  for (const game of games) for (const name of game.details?.platforms ?? []) names.add(name);
  return Array.from(names).sort((a, b) => a.localeCompare(b));
}

export function toggleMode(filter: GameFilter, mode: ModeFilter): GameFilter {
  const modes = filter.modes.includes(mode) ? filter.modes.filter((m) => m !== mode) : [...filter.modes, mode];
  return { ...filter, modes };
}
