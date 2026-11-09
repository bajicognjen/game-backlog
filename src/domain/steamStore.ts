/**
 * Steam's own store data (`IStoreBrowseService/GetItems`), which needs no key:
 * names for wishlist app ids, and for a game in the app its Steam Deck
 * rating, review summary, release date and a portrait cover for games IGDB
 * has none for. This module is pure; the request lives in `platform/steam.ts`.
 */
import { toIsoDate } from "./dates";

/** Steam Deck compatibility as the store rates it. */
export type DeckCompat = "verified" | "playable" | "unsupported" | "unknown";

export interface SteamStoreItem {
  appid: number;
  name: string;
  storeUrl: string;
  /** Day of the Steam release (UTC), or null when unknown or still to come. */
  releaseDate: string | null;
  comingSoon: boolean;
  deck: DeckCompat;
  /** "Overwhelmingly Positive" and so on; null with too few reviews. */
  reviewLabel: string | null;
  reviewPercent: number | null;
  reviewCount: number | null;
  /** Portrait library art (600×900), the closest to a box cover. */
  coverUrl: string | null;
}

/** Steam's image host for store assets (the Cloudflare one only redirects). */
const ASSET_BASE = "https://shared.akamai.steamstatic.com/store_item_assets/";
const STORE_BASE = "https://store.steampowered.com/";

/** How many app ids one store request asks for. */
export const STORE_ITEMS_PER_REQUEST = 50;

const DECK: Record<number, DeckCompat> = { 0: "unknown", 1: "unsupported", 2: "playable", 3: "verified" };

/** The `input_json` of a GetItems request for these apps, in English and US pricing (prices are not used). */
export function storeItemsInput(appIds: readonly number[]): string {
  return JSON.stringify({
    ids: appIds.map((appid) => ({ appid: Math.trunc(appid) })),
    context: { language: "english", country_code: "US" },
    data_request: { include_assets: true, include_release: true, include_platforms: true, include_reviews: true },
  });
}

/** One `store_items` row as the app uses it, or null for a row Steam could not answer (`success` other than 1, no name). */
export function mapStoreItem(raw: unknown): SteamStoreItem | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const appid = typeof r.appid === "number" ? r.appid : typeof r.id === "number" ? r.id : null;
  if (appid === null || typeof r.name !== "string" || r.name.trim() === "" || (r.success !== undefined && r.success !== 1)) return null;
  const release = (r.release ?? {}) as Record<string, unknown>;
  const platforms = (r.platforms ?? {}) as Record<string, unknown>;
  const reviews = ((r.reviews ?? {}) as Record<string, unknown>).summary_filtered as Record<string, unknown> | undefined;
  const assets = (r.assets ?? {}) as Record<string, unknown>;
  const releaseSeconds = typeof release.steam_release_date === "number" ? release.steam_release_date : null;
  const comingSoon = release.is_coming_soon === true;
  return {
    appid,
    name: r.name.trim(),
    storeUrl: typeof r.store_url_path === "string" && r.store_url_path !== "" ? STORE_BASE + r.store_url_path : `${STORE_BASE}app/${appid}/`,
    releaseDate: releaseSeconds && !comingSoon ? toIsoDate(releaseSeconds * 1000) : null,
    comingSoon,
    deck: DECK[typeof platforms.steam_deck_compat_category === "number" ? platforms.steam_deck_compat_category : 0] ?? "unknown",
    reviewLabel: typeof reviews?.review_score_label === "string" && reviews.review_score_label !== "" ? reviews.review_score_label : null,
    reviewPercent: typeof reviews?.percent_positive === "number" ? reviews.percent_positive : null,
    reviewCount: typeof reviews?.review_count === "number" ? reviews.review_count : null,
    coverUrl: assetUrl(assets, "library_capsule"),
  };
}

/** A store asset's full URL from the item's `asset_url_format`, or null without it. */
function assetUrl(assets: Record<string, unknown>, name: string): string | null {
  const format = assets.asset_url_format;
  const file = assets[name];
  if (typeof format !== "string" || typeof file !== "string" || file === "" || !format.includes("${FILENAME}")) return null;
  return ASSET_BASE + format.replace("${FILENAME}", file);
}
