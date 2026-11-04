/**
 * Provider-neutral shapes for game search. IGDB maps its API responses into
 * these (see `igdb.ts`); the rest of the app never sees a provider-specific
 * field, so another database could be added behind the same interface.
 */
import type { GameDetails } from "./details";
import type { Game, GameSource, GameType, Genre } from "./types";

/** One row in the search dropdown. */
export interface SearchHit {
  source: GameSource;
  externalId: number;
  title: string;
  releaseDate: string | null;
  coverUrl: string | null;
  platforms: string[];
  /** Record kind ("main", "remake", "dlc", …) when the source says; null otherwise. */
  kind: string | null;
  /** Edition name for versions of a parent game, e.g. "Definitive Edition". */
  edition: string | null;
}

/** What a picked game contributes to the add/edit form and the stored row. */
export interface GameMetadata {
  source: GameSource;
  externalId: number;
  title: string;
  coverUrl: string | null;
  releaseDate: string | null;
  providerGenres: string[];
  /** Normalised tags shared by both sources: "Singleplayer", "Multiplayer", "Open World", "Horror", … */
  providerTags: string[];
  /** Typical hours to finish, when the source knows; null otherwise. */
  playtimeHours: number | null;
  /** Our genre, derived from tags first and genres second. */
  genre: Genre | null;
  /** Our type suggestion: "open_world" when the source says so, else null (keep the user's choice). */
  typeHint: GameType | null;
  singleplayer: boolean;
  multiplayer: boolean;
  openWorld: boolean;
  /** Series suggestion from the source's collection or franchise, if any. */
  seriesHint: string | null;
  details: GameDetails | null;
}

/** The metadata columns of a stored game. */
export type Metadata = Pick<Game, "source" | "externalId" | "coverUrl" | "releaseDate" | "providerGenres" | "providerTags" | "details">;

export function metadataOf(game: Game): Metadata {
  return {
    source: game.source,
    externalId: game.externalId,
    coverUrl: game.coverUrl,
    releaseDate: game.releaseDate,
    providerGenres: game.providerGenres,
    providerTags: game.providerTags,
    details: game.details,
  };
}

export function toMetadata(meta: GameMetadata): Metadata {
  return {
    source: meta.source,
    externalId: meta.externalId,
    coverUrl: meta.coverUrl,
    releaseDate: meta.releaseDate,
    providerGenres: meta.providerGenres,
    providerTags: meta.providerTags,
    details: meta.details,
  };
}

/** The tag vocabulary providers normalise to, so the UI and the genre rules rely on one set of names. */
export const TAG_SINGLEPLAYER = "Singleplayer";
export const TAG_MULTIPLAYER = "Multiplayer";
export const TAG_COOP = "Co-op";
export const TAG_OPEN_WORLD = "Open World";

/** Tag-derived genres win over broad genres, most specific first. */
export const GENRE_BY_TAG: ReadonlyArray<[string, Genre]> = [
  ["Metroidvania", "metroidvania"],
  ["Souls-like", "soulslike"],
  ["Roguelike", "roguelike"],
  ["Survival Horror", "horror"],
  ["Horror", "horror"],
  ["Survival", "survival"],
  ["Stealth", "stealth"],
  ["Hack and Slash", "hack_and_slash"],
  ["Visual Novel", "narrative"],
  ["Interactive Fiction", "narrative"],
  ["Point-and-click", "narrative"],
];

/**
 * Pick our genre from normalised genre codes and tags. `genres` are already
 * our codes (each provider translates its own names); Action + Adventure
 * together mean Action-Adventure, and the vaguest codes lose ties.
 */
export function pickGenre(genres: readonly Genre[], tags: readonly string[]): Genre | null {
  for (const [tag, genre] of GENRE_BY_TAG) {
    if (tags.includes(tag)) return genre;
  }
  // A specific genre (RPG, Shooter, Puzzle, …) beats the broad Action/Adventure pair.
  const specific = genres.find((g) => g !== "action" && g !== "other" && g !== "adventure");
  if (specific) return specific;
  if (genres.includes("action") && genres.includes("adventure")) return "action_adventure";
  return genres[0] ?? null;
}

/** A small version of a cover. IGDB sizes are named presets: t_cover_small is 90×128, t_cover_big 264×374. */
export function thumbnailUrl(coverUrl: string, width = 200): string {
  if (coverUrl.includes("images.igdb.com")) {
    return coverUrl.replace(/\/t_[a-z_0-9]+\//, width >= 200 ? "/t_cover_big/" : "/t_cover_small/");
  }
  return coverUrl;
}

/** The year from an ISO date, for "Title (2015)". */
export function releaseYear(releaseDate: string | null): string | null {
  return releaseDate ? releaseDate.slice(0, 4) : null;
}
