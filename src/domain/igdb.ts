/**
 * Mapping from IGDB's API shapes (https://api-docs.igdb.com) to the
 * provider-neutral types, plus the Apicalypse query strings the client
 * sends. No network code here; see `platform/igdb.ts`.
 */
import { toIsoDate } from "./dates";
import { TAG_COOP, TAG_MULTIPLAYER, TAG_OPEN_WORLD, TAG_SINGLEPLAYER, pickGenre, type GameMetadata, type SearchHit } from "./provider";
import type { Genre } from "./types";

/** A game from `POST /v4/games` with the fields `GAME_FIELDS` asks for. */
export interface IgdbGame {
  id: number;
  name: string;
  /** Unix seconds (UTC). */
  first_release_date?: number | null;
  cover?: { url: string } | null;
  genres?: { name: string }[] | null;
  themes?: { name: string }[] | null;
  game_modes?: { name: string }[] | null;
  platforms?: { abbreviation?: string | null; name?: string | null }[] | null;
  summary?: string | null;
  total_rating?: number | null;
}

/** A row from `POST /v4/game_time_to_beats`; durations are seconds. */
export interface IgdbTimeToBeat {
  game_id: number;
  normally?: number | null;
  hastily?: number | null;
  completely?: number | null;
}

export const GAME_FIELDS =
  "id,name,first_release_date,cover.url,genres.name,themes.name,game_modes.name,platforms.abbreviation,platforms.name,summary,total_rating";

/** Apicalypse: `search` cannot be combined with `sort`; limit keeps the dropdown short. */
export function searchQuery(text: string, limit = 10): string {
  return `search ${quote(text)}; fields ${GAME_FIELDS}; limit ${limit};`;
}

export function gameByIdQuery(id: number): string {
  return `fields ${GAME_FIELDS}; where id = ${Math.trunc(id)};`;
}

export function timeToBeatQuery(gameId: number): string {
  return `fields game_id,normally,hastily,completely; where game_id = ${Math.trunc(gameId)};`;
}

function quote(text: string): string {
  return `"${text.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** IGDB image URLs come as `//images.igdb.com/.../t_thumb/xyz.jpg`; pick a size and make them absolute. */
export function igdbImageUrl(url: string, size = "t_cover_big"): string {
  const absolute = url.startsWith("//") ? `https:${url}` : url;
  return absolute.replace(/\/t_[a-z_0-9]+\//, `/${size}/`);
}

export function unixToIsoDate(seconds: number | null | undefined): string | null {
  if (!seconds || !Number.isFinite(seconds)) return null;
  return toIsoDate(seconds * 1000);
}

const GENRE_BY_IGDB_GENRE: Record<string, Genre> = {
  "Role-playing (RPG)": "rpg",
  Shooter: "shooter",
  Platform: "platformer",
  Puzzle: "puzzle",
  Racing: "racing",
  Sport: "sports",
  Strategy: "strategy",
  "Real Time Strategy (RTS)": "strategy",
  "Turn-based strategy (TBS)": "strategy",
  Tactical: "strategy",
  Simulator: "simulation",
  Fighting: "fighting",
  Adventure: "adventure",
  "Hack and slash/Beat 'em up": "hack_and_slash",
  "Visual Novel": "narrative",
  "Point-and-click": "narrative",
  Arcade: "action",
  "Card & Board Game": "other",
  "Quiz/Trivia": "other",
  Pinball: "other",
  Music: "other",
  MOBA: "other",
};

/** IGDB themes and game modes, translated to the shared tag vocabulary. */
const TAG_BY_THEME: Record<string, string> = {
  "Open world": TAG_OPEN_WORLD,
  Horror: "Horror",
  Survival: "Survival",
  Stealth: "Stealth",
  Sandbox: "Sandbox",
  "Science fiction": "Science Fiction",
  Fantasy: "Fantasy",
  Thriller: "Thriller",
  Historical: "Historical",
  Drama: "Drama",
  Mystery: "Mystery",
  Comedy: "Comedy",
  Warfare: "Warfare",
  Kids: "Kids",
};

const TAG_BY_GAME_MODE: Record<string, string> = {
  "Single player": TAG_SINGLEPLAYER,
  Multiplayer: TAG_MULTIPLAYER,
  "Co-operative": TAG_COOP,
  "Split screen": TAG_COOP,
  "Massively Multiplayer Online (MMO)": "MMO",
  "Battle Royale": "Battle Royale",
};

export function mapIgdbSearchResult(game: IgdbGame): SearchHit {
  return {
    source: "igdb",
    externalId: game.id,
    title: game.name.trim(),
    releaseDate: unixToIsoDate(game.first_release_date),
    coverUrl: game.cover?.url ? igdbImageUrl(game.cover.url) : null,
    platforms: (game.platforms ?? []).map((p) => p.abbreviation || p.name || "").filter(Boolean),
  };
}

export function mapIgdbGame(game: IgdbGame, normallySeconds: number | null = null): GameMetadata {
  const genreNames = (game.genres ?? []).map((g) => g.name);
  const themeNames = (game.themes ?? []).map((t) => t.name);
  // "Action" is a theme on IGDB, not a genre; the shared rules treat it as a genre code.
  const providerGenres = [...(themeNames.includes("Action") ? ["Action"] : []), ...genreNames];
  const providerTags = unique([
    ...(game.game_modes ?? []).map((m) => TAG_BY_GAME_MODE[m.name]).filter((t): t is string => t !== undefined),
    ...themeNames.map((t) => TAG_BY_THEME[t]).filter((t): t is string => t !== undefined),
  ]);
  const has = (tag: string) => providerTags.includes(tag);
  const openWorld = has(TAG_OPEN_WORLD);

  return {
    source: "igdb",
    externalId: game.id,
    title: game.name.trim(),
    coverUrl: game.cover?.url ? igdbImageUrl(game.cover.url) : null,
    releaseDate: unixToIsoDate(game.first_release_date),
    providerGenres,
    providerTags,
    playtimeHours: normallySeconds && normallySeconds > 0 ? Math.round(normallySeconds / 3600) : null,
    genre: deriveGenre(genreNames, themeNames, providerTags),
    typeHint: openWorld ? "open_world" : null,
    singleplayer: has(TAG_SINGLEPLAYER),
    multiplayer: has(TAG_MULTIPLAYER) || has(TAG_COOP),
    openWorld,
  };
}

export function deriveGenre(genreNames: readonly string[], themeNames: readonly string[], tags: readonly string[]): Genre | null {
  const codes: Genre[] = [];
  if (themeNames.includes("Action")) codes.push("action");
  for (const name of genreNames) {
    const code = GENRE_BY_IGDB_GENRE[name];
    if (code) codes.push(code);
  }
  return pickGenre(codes, tags);
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}
