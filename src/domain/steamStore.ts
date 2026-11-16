/**
 * Steam's own store data (`IStoreBrowseService/GetItems`), which needs no key:
 * names and prices for wishlist app ids, and for a game in the app its Steam
 * Deck rating, review summary, release date and a portrait cover for games
 * IGDB has none for. This module is pure; the request lives in
 * `platform/steam.ts`.
 */
import { toIsoDate } from "./dates";

/** Steam Deck compatibility as the store rates it. */
export type DeckCompat = "verified" | "playable" | "unsupported" | "unknown";

/** What the store charges for the game on its own, in the country asked for. */
export interface SteamPrice {
  /** In the currency's minor unit (cents); the two are equal without a discount. */
  finalCents: number;
  originalCents: number;
  /** As Steam formats them for that country ("26,65€"). */
  finalText: string;
  originalText: string;
  /** Whole percent off; 0 without a discount. */
  discountPct: number;
  /** When the discount ends (epoch milliseconds), or null without a discount or when Steam names no end. */
  discountEndsAt: number | null;
}

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
  /** Free to play or free to keep. */
  free: boolean;
  /** Null for a free game and for one the store does not sell on its own (unreleased, delisted, bundle only). */
  price: SteamPrice | null;
}

/** The store region prices come from when none is set: Serbia, which Steam prices in euros. */
export const DEFAULT_STEAM_COUNTRY = "RS";

/** A two-letter country code (ISO 3166-1 alpha-2), in either case, blanks around it allowed. */
export function isSteamCountry(value: string): boolean {
  return /^[A-Za-z]{2}$/.test(value.trim());
}

/** A stored country setting as the store expects it (upper case), or the default for anything else. */
export function parseSteamCountry(value: unknown): string {
  return typeof value === "string" && isSteamCountry(value) ? value.trim().toUpperCase() : DEFAULT_STEAM_COUNTRY;
}

/** Steam's image host for store assets (the Cloudflare one only redirects). */
const ASSET_BASE = "https://shared.akamai.steamstatic.com/store_item_assets/";
const STORE_BASE = "https://store.steampowered.com/";

/** How many app ids one store request asks for. */
export const STORE_ITEMS_PER_REQUEST = 50;

const DECK: Record<number, DeckCompat> = { 0: "unknown", 1: "unsupported", 2: "playable", 3: "verified" };

/** The `input_json` of a GetItems request for these apps, in English, priced for `country` (a two-letter code). */
export function storeItemsInput(appIds: readonly number[], country: string): string {
  return JSON.stringify({
    ids: appIds.map((appid) => ({ appid: Math.trunc(appid) })),
    context: { language: "english", country_code: parseSteamCountry(country) },
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
  const free = r.is_free === true;
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
    free,
    price: free ? null : mapPrice(r.best_purchase_option),
  };
}

/** The row's `best_purchase_option` as a price, or null without one or when its amount does not parse. */
function mapPrice(raw: unknown): SteamPrice | null {
  if (typeof raw !== "object" || raw === null) return null;
  const p = raw as Record<string, unknown>;
  const finalCents = cents(p.final_price_in_cents);
  if (finalCents === null) return null;
  const finalText = typeof p.formatted_final_price === "string" ? p.formatted_final_price : "";
  const originalText = typeof p.formatted_original_price === "string" && p.formatted_original_price !== "" ? p.formatted_original_price : finalText;
  const discountPct = typeof p.discount_pct === "number" && p.discount_pct > 0 ? Math.trunc(p.discount_pct) : 0;
  // Discounts can stack; the price holds only until the first of them ends.
  const ends = (Array.isArray(p.active_discounts) ? p.active_discounts : [])
    .map((d: unknown) => (typeof d === "object" && d !== null ? (d as Record<string, unknown>).discount_end_date : undefined))
    .filter((s): s is number => typeof s === "number" && s > 0);
  return {
    finalCents,
    originalCents: cents(p.original_price_in_cents) ?? finalCents,
    finalText,
    originalText,
    discountPct,
    discountEndsAt: discountPct > 0 && ends.length > 0 ? Math.min(...ends) * 1000 : null,
  };
}

/** Steam sends amounts as decimal strings of cents ("2665"); null for anything else. */
function cents(value: unknown): number | null {
  const n = typeof value === "string" && /^\d+$/.test(value) ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** A store asset's full URL from the item's `asset_url_format`, or null without it. */
function assetUrl(assets: Record<string, unknown>, name: string): string | null {
  const format = assets.asset_url_format;
  const file = assets[name];
  if (typeof format !== "string" || typeof file !== "string" || file === "" || !format.includes("${FILENAME}")) return null;
  return ASSET_BASE + format.replace("${FILENAME}", file);
}
