/**
 * Mapping from IGDB's API shapes (https://api-docs.igdb.com) to the
 * provider-neutral types, plus the Apicalypse query strings the client
 * sends. No network code here; see `platform/igdb.ts`.
 */
import { toIsoDate } from "./dates";
import { storeLinksFrom, type GameDetails } from "./details";
import { gameTypeFrom } from "./gameType";
import {
  TAG_BASE_BUILDING,
  TAG_COOP,
  TAG_METROIDVANIA,
  TAG_MULTIPLAYER,
  TAG_OPEN_WORLD,
  TAG_ROGUELIKE,
  TAG_SANDBOX,
  TAG_SEMI_OPEN,
  TAG_SINGLEPLAYER,
  pickGenre,
  type GameMetadata,
  type SearchHit,
} from "./provider";
import type { Genre } from "./types";

/** A game from `POST /v4/games` with the fields `SEARCH_FIELDS` asks for. */
export interface IgdbGame {
  id: number;
  name: string;
  /** Unix seconds (UTC). */
  first_release_date?: number | null;
  cover?: { url: string } | null;
  /** Record kind (see `GAME_KINDS`); `game_type` is the current field, `category` the one being retired. */
  game_type?: number | null;
  category?: number | null;
  /** "Definitive Edition", "Game of the Year Edition", … on versions of a parent game. */
  version_title?: string | null;
  genres?: { name: string }[] | null;
  themes?: { name: string }[] | null;
  game_modes?: { name: string }[] | null;
  platforms?: { abbreviation?: string | null; name?: string | null }[] | null;
  summary?: string | null;
  total_rating?: number | null;
}

/** The full record `DETAIL_FIELDS` asks for: everything above plus media, ratings, companies and links. */
export interface IgdbGameDetails extends IgdbGame {
  rating?: number | null;
  aggregated_rating?: number | null;
  involved_companies?: { company?: { name?: string | null } | null; developer?: boolean | null; publisher?: boolean | null }[] | null;
  screenshots?: { url: string }[] | null;
  videos?: { video_id?: string | null; name?: string | null }[] | null;
  similar_games?: { id: number; name: string; cover?: { url: string } | null }[] | null;
  franchises?: { name: string }[] | null;
  collection?: { name: string } | null;
  external_games?: { name?: string | null; uid?: string | null; url?: string | null }[] | null;
  keywords?: { name?: string | null }[] | null;
}

/** A row from `POST /v4/game_time_to_beats`; durations are seconds. */
export interface IgdbTimeToBeat {
  game_id: number;
  normally?: number | null;
  hastily?: number | null;
  completely?: number | null;
}

/** Enough for the dropdown; kept small so searches stay quick. */
export const SEARCH_FIELDS = "id,name,first_release_date,cover.url,platforms.abbreviation,platforms.name,version_title";

/** IGDB's record kinds by number, as used by both `game_type` and the retired `category`. */
export const GAME_KINDS = {
  0: "main",
  1: "dlc",
  2: "expansion",
  3: "bundle",
  4: "standalone_expansion",
  5: "mod",
  6: "episode",
  7: "season",
  8: "remake",
  9: "remaster",
  10: "expanded",
  11: "port",
  12: "fork",
  13: "pack",
  14: "update",
} as const;
export type GameKind = (typeof GAME_KINDS)[keyof typeof GAME_KINDS];

/** Everything the app caches, in one request: nested expansions resolve the related records server-side. */
export const DETAIL_FIELDS = [
  "id",
  "name",
  "first_release_date",
  "cover.url",
  "genres.name",
  "themes.name",
  "game_modes.name",
  "platforms.abbreviation",
  "platforms.name",
  "summary",
  "rating",
  "aggregated_rating",
  "involved_companies.company.name",
  "involved_companies.developer",
  "involved_companies.publisher",
  "screenshots.url",
  "videos.video_id",
  "videos.name",
  "similar_games.name",
  "similar_games.cover.url",
  "franchises.name",
  "collection.name",
  "external_games.name",
  "external_games.uid",
  "external_games.url",
  "keywords.name",
].join(",");

/**
 * Which field names the kind of a game record: IGDB introduced `game_type`
 * in 2025 and is retiring `category`; "none" skips the filter altogether.
 */
export type SearchFilterVariant = "game_type" | "category" | "none";

/** Main games, standalone expansions, remakes, remasters, expanded games and ports; editions of a parent stay in. */
export const MAIN_GAME_TYPES = "(0,4,8,9,10,11)";
/** The above plus DLC, expansions, episodes and packs, for when the user wants add-ons too. */
export const WITH_ADDON_TYPES = "(0,1,2,4,6,8,9,10,11,13)";

/**
 * Apicalypse search: `search` cannot be combined with `sort`. The `where`
 * keeps the list to playable entries (no bundles, mods, seasons, updates);
 * `includeAddons` lets DLC and expansions through as well. The kind field
 * is requested with the same name the filter uses, so the dropdown can label
 * each result.
 */
export function searchQuery(text: string, limit = 15, variant: SearchFilterVariant = "game_type", includeAddons = false): string {
  const fields = variant === "none" ? SEARCH_FIELDS : `${SEARCH_FIELDS},${variant}`;
  const where = variant === "none" ? "" : ` where ${variant} = ${includeAddons ? WITH_ADDON_TYPES : MAIN_GAME_TYPES};`;
  return `search ${quote(text)}; fields ${fields};${where} limit ${limit};`;
}

/** Letters and digits only, lower-case: "The Forest" and "the forest!" compare equal. */
export function normaliseTitle(text: string): string {
  return text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

/**
 * Put the most likely wanted rows first: exact title matches, then titles
 * that start with the query, then main games before add-ons; IGDB's own
 * relevance order is kept inside each group.
 */
export function rankSearchHits<T extends { title: string; kind: string | null }>(hits: readonly T[], query: string): T[] {
  const q = normaliseTitle(query);
  const score = (hit: T): number => {
    const title = normaliseTitle(hit.title);
    const addon = hit.kind === "dlc" || hit.kind === "expansion" || hit.kind === "episode" || hit.kind === "pack";
    if (title === q) return addon ? 1 : 0;
    if (title.startsWith(q)) return addon ? 3 : 2;
    return addon ? 5 : 4;
  };
  return hits
    .map((hit, index) => ({ hit, index, score: score(hit) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map((entry) => entry.hit);
}

/** The record kind of a search row, from whichever field IGDB returned. */
export function gameKindOf(game: Pick<IgdbGame, "game_type" | "category">): GameKind | null {
  const code = game.game_type ?? game.category ?? null;
  return code !== null && code in GAME_KINDS ? GAME_KINDS[code as keyof typeof GAME_KINDS] : null;
}

export function gameByIdQuery(id: number): string {
  return `fields ${DETAIL_FIELDS}; where id = ${Math.trunc(id)};`;
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

/**
 * IGDB keywords (free-form community tags, compared lower-case) that say
 * something about a game's design. Everything else stays in the cached
 * keyword list only.
 */
const TAG_BY_KEYWORD: Record<string, string> = {
  "open world": TAG_OPEN_WORLD,
  "semi-open world": TAG_SEMI_OPEN,
  "semi open world": TAG_SEMI_OPEN,
  "hub world": TAG_SEMI_OPEN,
  "hub worlds": TAG_SEMI_OPEN,
  "interconnected world": TAG_SEMI_OPEN,
  sandbox: TAG_SANDBOX,
  "base building": TAG_BASE_BUILDING,
  "base-building": TAG_BASE_BUILDING,
  metroidvania: TAG_METROIDVANIA,
  roguelike: TAG_ROGUELIKE,
  "rogue-like": TAG_ROGUELIKE,
  roguelite: TAG_ROGUELIKE,
  "rogue-lite": TAG_ROGUELIKE,
  "souls-like": "Souls-like",
  soulslike: "Souls-like",
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
    kind: gameKindOf(game),
    edition: game.version_title?.trim() || null,
  };
}

export function mapIgdbGame(game: IgdbGameDetails, normallySeconds: number | null = null, now: Date = new Date()): GameMetadata {
  const genreNames = (game.genres ?? []).map((g) => g.name);
  const themeNames = (game.themes ?? []).map((t) => t.name);
  // "Action" is a theme on IGDB, not a genre; the shared rules treat it as a genre code.
  const providerGenres = [...(themeNames.includes("Action") ? ["Action"] : []), ...genreNames];
  const providerTags = unique([
    ...(game.game_modes ?? []).map((m) => TAG_BY_GAME_MODE[m.name]).filter((t): t is string => t !== undefined),
    ...themeNames.map((t) => TAG_BY_THEME[t]).filter((t): t is string => t !== undefined),
    ...keywordsOf(game).map((k) => TAG_BY_KEYWORD[k]).filter((t): t is string => t !== undefined),
  ]);
  const has = (tag: string) => providerTags.includes(tag);
  const openWorld = has(TAG_OPEN_WORLD);
  const playtimeHours = normallySeconds && normallySeconds > 0 ? Math.round(normallySeconds / 3600) : null;

  return {
    source: "igdb",
    externalId: game.id,
    title: game.name.trim(),
    coverUrl: game.cover?.url ? igdbImageUrl(game.cover.url) : null,
    releaseDate: unixToIsoDate(game.first_release_date),
    providerGenres,
    providerTags,
    playtimeHours,
    genre: deriveGenre(genreNames, themeNames, providerTags),
    typeHint: gameTypeFrom({ providerGenres, providerTags }),
    singleplayer: has(TAG_SINGLEPLAYER),
    multiplayer: has(TAG_MULTIPLAYER) || has(TAG_COOP),
    openWorld,
    seriesHint: game.collection?.name ?? game.franchises?.[0]?.name ?? null,
    details: mapIgdbDetails(game, now),
  };
}

/** The cached detail record; null when IGDB gave nothing beyond the basics. */
export function mapIgdbDetails(game: IgdbGameDetails, now: Date = new Date()): GameDetails {
  const companies = game.involved_companies ?? [];
  const names = (filter: (c: (typeof companies)[number]) => boolean) =>
    unique(companies.filter(filter).map((c) => c.company?.name ?? "").filter(Boolean));
  return {
    summary: game.summary?.trim() || null,
    platforms: unique((game.platforms ?? []).map((p) => p.name || p.abbreviation || "").filter(Boolean)),
    userRating: round1(game.rating),
    criticRating: round1(game.aggregated_rating),
    developers: names((c) => c.developer === true),
    publishers: names((c) => c.publisher === true),
    screenshots: (game.screenshots ?? []).map((s) => igdbImageUrl(s.url, "t_screenshot_med")),
    videos: (game.videos ?? [])
      .filter((v): v is { video_id: string; name?: string | null } => typeof v.video_id === "string" && v.video_id !== "")
      .map((v) => ({ id: v.video_id, name: v.name?.trim() || "Video" })),
    similarGames: (game.similar_games ?? []).map((g) => ({
      igdbId: g.id,
      title: g.name.trim(),
      coverUrl: g.cover?.url ? igdbImageUrl(g.cover.url) : null,
    })),
    franchises: (game.franchises ?? []).map((f) => f.name),
    collection: game.collection?.name ?? null,
    storeLinks: storeLinksFrom(game.external_games ?? []),
    keywords: keywordsOf(game),
    fetchedAt: now.toISOString(),
  };
}

/** Keyword names, trimmed, lower-case and without repeats. */
function keywordsOf(game: IgdbGameDetails): string[] {
  return unique((game.keywords ?? []).map((k) => k.name?.trim().toLowerCase() ?? "").filter(Boolean));
}

function round1(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
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
