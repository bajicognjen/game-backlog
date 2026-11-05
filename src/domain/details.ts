/**
 * Extra data cached per game from IGDB: media, ratings, companies, store
 * links and recommendations. Stored as one JSON column so the schema stays
 * small; the app reads it, never queries inside it.
 */

export interface GameVideo {
  /** YouTube video id. */
  id: string;
  name: string;
}

export interface SimilarGame {
  igdbId: number;
  title: string;
  coverUrl: string | null;
}

export type StoreName = "Steam" | "Epic Games" | "GOG" | "PlayStation Store" | "Xbox" | "Nintendo" | "itch.io";

export interface StoreLink {
  store: StoreName;
  url: string;
}

export interface GameDetails {
  summary: string | null;
  /** Platform names IGDB lists (e.g. "PC (Microsoft Windows)", "PlayStation 5"). */
  platforms: string[];
  /** 0–100, from IGDB users; null when unrated. */
  userRating: number | null;
  /** 0–100, aggregated critic score; null when absent. */
  criticRating: number | null;
  developers: string[];
  publishers: string[];
  /** Absolute URLs of screenshots at a medium size. */
  screenshots: string[];
  videos: GameVideo[];
  similarGames: SimilarGame[];
  franchises: string[];
  collection: string | null;
  storeLinks: StoreLink[];
  /** IGDB keywords, lower-case; the design rules read the ones they know through the tags. */
  keywords: string[];
  /** ISO timestamp of the fetch, so stale caches can be refreshed later. */
  fetchedAt: string;
}

/** Stores recognised from an `external_games.url`; everything else (YouTube, Twitch, …) is ignored. */
const STORE_BY_HOST: [RegExp, StoreName][] = [
  [/(^|\.)store\.steampowered\.com$/, "Steam"],
  [/(^|\.)steampowered\.com$/, "Steam"],
  [/(^|\.)epicgames\.com$/, "Epic Games"],
  [/(^|\.)gog\.com$/, "GOG"],
  [/(^|\.)playstation\.com$/, "PlayStation Store"],
  [/(^|\.)xbox\.com$/, "Xbox"],
  [/(^|\.)microsoft\.com$/, "Xbox"],
  [/(^|\.)nintendo\.(com|co\.uk|co\.jp|de|fr|es|it)$/, "Nintendo"],
  [/(^|\.)itch\.io$/, "itch.io"],
];

/**
 * Turn IGDB's external game entries into store links. IGDB's own `url` field
 * is used as-is; the store is recognised from the host, which avoids the
 * numeric `category` codes IGDB is phasing out. One link per store.
 */
export function storeLinksFrom(entries: ReadonlyArray<{ url?: string | null }>): StoreLink[] {
  const links: StoreLink[] = [];
  for (const entry of entries) {
    if (!entry.url) continue;
    let host: string;
    try {
      host = new URL(entry.url).hostname.toLowerCase();
    } catch {
      continue;
    }
    const match = STORE_BY_HOST.find(([pattern]) => pattern.test(host));
    if (!match) continue;
    if (links.some((link) => link.store === match[1])) continue;
    links.push({ store: match[1], url: entry.url });
  }
  return links.sort((a, b) => STORE_ORDER.indexOf(a.store) - STORE_ORDER.indexOf(b.store));
}

const STORE_ORDER: StoreName[] = ["Steam", "Epic Games", "GOG", "PlayStation Store", "Xbox", "Nintendo", "itch.io"];

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}`;
}

export function youtubeThumbnailUrl(videoId: string): string {
  return `https://img.youtube.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`;
}

/** Parse a cached JSON column; anything unexpected is treated as "no details". */
export function parseDetails(json: string | null): GameDetails | null {
  if (!json) return null;
  try {
    const raw: unknown = JSON.parse(json);
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
    const d = raw as Record<string, unknown>;
    const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);
    const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
    return {
      summary: typeof d.summary === "string" ? d.summary : null,
      platforms: strings(d.platforms),
      userRating: num(d.userRating),
      criticRating: num(d.criticRating),
      developers: strings(d.developers),
      publishers: strings(d.publishers),
      screenshots: strings(d.screenshots),
      videos: Array.isArray(d.videos)
        ? d.videos.filter((v): v is GameVideo => typeof v === "object" && v !== null && typeof (v as GameVideo).id === "string")
        : [],
      similarGames: Array.isArray(d.similarGames)
        ? d.similarGames.filter(
            (g): g is SimilarGame => typeof g === "object" && g !== null && typeof (g as SimilarGame).igdbId === "number" && typeof (g as SimilarGame).title === "string",
          )
        : [],
      franchises: strings(d.franchises),
      collection: typeof d.collection === "string" ? d.collection : null,
      storeLinks: Array.isArray(d.storeLinks)
        ? d.storeLinks.filter((l): l is StoreLink => typeof l === "object" && l !== null && typeof (l as StoreLink).url === "string")
        : [],
      keywords: strings(d.keywords),
      fetchedAt: typeof d.fetchedAt === "string" ? d.fetchedAt : new Date(0).toISOString(),
    };
  } catch {
    return null;
  }
}
