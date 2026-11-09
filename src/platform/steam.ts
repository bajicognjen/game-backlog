/**
 * Steam Web API client (https://steamcommunity.com/dev). Requests carry the
 * user's Web API key; the key identifies the caller, not the account, so the
 * profile's "Game details" must be public for its games to come back.
 */
import type { SteamAchievement } from "../domain/achievements";
import { parseSteamIdInput, type SteamOwnedGame } from "../domain/steam";
import { STORE_ITEMS_PER_REQUEST, mapStoreItem, storeItemsInput, type SteamStoreItem } from "../domain/steamStore";
import { ProviderError, fetchWithTimeout } from "./http";

const BASE_URL = "https://api.steampowered.com";

export type SteamFailure =
  /** No key or no account in Settings. */
  | "no-credentials"
  /** Steam rejected the key (HTTP 401/403). */
  | "unauthorized"
  /** The custom URL name did not resolve to an account. */
  | "unknown-account"
  /** Steam answered without games: the profile's game details are private, or the id is wrong. */
  | "private"
  | "network"
  | "other";

export class SteamError extends Error {
  constructor(
    public readonly reason: SteamFailure,
    public readonly status: number | null = null,
  ) {
    super(reason);
    this.name = "SteamError";
  }
}

/** Why a Steam request failed, for the message the import shows. */
export function steamFailureOf(error: unknown): SteamFailure {
  if (error instanceof SteamError) return error.reason;
  if (error instanceof ProviderError && error.reason === "network") return "network";
  return "other";
}

export interface SteamCredentials {
  apiKey: string;
  steamId: string;
}

/**
 * Turn the Settings value into a SteamID64, resolving a custom URL name
 * through `ISteamUser/ResolveVanityURL` when needed.
 */
export async function resolveSteamId(apiKey: string, account: string, signal?: AbortSignal): Promise<string> {
  const input = parseSteamIdInput(account);
  if (!input) throw new SteamError("no-credentials");
  if (input.kind === "id") return input.steamId;
  const data = await steamGet<{ response?: { success?: number; steamid?: string } }>(
    "ISteamUser/ResolveVanityURL/v1",
    { key: apiKey, vanityurl: input.name },
    signal,
  );
  const steamId = data.response?.success === 1 ? data.response.steamid : undefined;
  if (!steamId || !/^\d{17}$/.test(steamId)) throw new SteamError("unknown-account");
  return steamId;
}

/** Every game the account owns, with names and total playtime. Free games count once they were played. */
export async function fetchOwnedGames({ apiKey, steamId }: SteamCredentials, signal?: AbortSignal): Promise<SteamOwnedGame[]> {
  const data = await steamGet<{ response?: { game_count?: number; games?: unknown[] } }>(
    "IPlayerService/GetOwnedGames/v1",
    { key: apiKey, steamid: steamId, include_appinfo: "1", include_played_free_games: "1" },
    signal,
  );
  // A private profile (or an id that is not an account) answers `{ "response": {} }`.
  if (!data.response || !Array.isArray(data.response.games)) throw new SteamError("private");
  return data.response.games.filter(isOwnedGame);
}

/** One game on the account's wishlist; Steam gives ids only, names come from the store. */
export interface SteamWishlistItem {
  appid: number;
  /** The owner's own ranking; 0 when unranked. */
  priority: number;
  /** Unix seconds. */
  dateAdded: number;
}

/**
 * The account's wishlist (`IWishlistService/GetWishlist`, no key needed). A
 * private or empty wishlist both come back as an empty list.
 */
export async function fetchWishlist(steamId: string, signal?: AbortSignal): Promise<SteamWishlistItem[]> {
  const data = await steamGet<{ response?: { items?: unknown[] } }>("IWishlistService/GetWishlist/v1", { steamid: steamId }, signal);
  return (data.response?.items ?? []).flatMap((value) => {
    if (typeof value !== "object" || value === null) return [];
    const i = value as Record<string, unknown>;
    if (typeof i.appid !== "number") return [];
    return [{ appid: i.appid, priority: typeof i.priority === "number" ? i.priority : 0, dateAdded: typeof i.date_added === "number" ? i.date_added : 0 }];
  });
}

/**
 * Store data for these apps (`IStoreBrowseService/GetItems`, no key needed),
 * by app id, asked in batches; apps Steam has no store page for are left out.
 */
export async function fetchStoreItems(appIds: readonly number[], signal?: AbortSignal): Promise<Map<number, SteamStoreItem>> {
  const items = new Map<number, SteamStoreItem>();
  for (let start = 0; start < appIds.length; start += STORE_ITEMS_PER_REQUEST) {
    const chunk = appIds.slice(start, start + STORE_ITEMS_PER_REQUEST);
    const data = await steamGet<{ response?: { store_items?: unknown[] } }>("IStoreBrowseService/GetItems/v1", { input_json: storeItemsInput(chunk) }, signal);
    for (const raw of data.response?.store_items ?? []) {
      const item = mapStoreItem(raw);
      if (item) items.set(item.appid, item);
    }
  }
  return items;
}

/** Who the account is, as `ISteamUser/GetPlayerSummaries` tells it. */
export interface SteamPlayerSummary {
  steamid: string;
  personaname: string;
  profileurl: string;
  /** 64 px avatar. */
  avatarmedium: string | null;
  /** False when the profile is private or friends-only: then Steam shares no games at all. */
  isPublic: boolean;
  /** The game being played right now, when Steam says so. */
  playing: string | null;
}

/** The account's public summary, or null when Steam knows no such account. Works for private profiles too. */
export async function fetchPlayerSummary({ apiKey, steamId }: SteamCredentials, signal?: AbortSignal): Promise<SteamPlayerSummary | null> {
  const data = await steamGet<{ response?: { players?: unknown[] } }>("ISteamUser/GetPlayerSummaries/v2", { key: apiKey, steamids: steamId }, signal);
  const player = data.response?.players?.[0];
  if (typeof player !== "object" || player === null) return null;
  const p = player as Record<string, unknown>;
  if (typeof p.steamid !== "string" || typeof p.personaname !== "string") return null;
  return {
    steamid: p.steamid,
    personaname: p.personaname,
    profileurl: typeof p.profileurl === "string" ? p.profileurl : `https://steamcommunity.com/profiles/${p.steamid}/`,
    avatarmedium: typeof p.avatarmedium === "string" && p.avatarmedium.startsWith("https://") ? p.avatarmedium : null,
    // 3 is public; 1 private and 2 friends-only both hide the games.
    isPublic: p.communityvisibilitystate === 3,
    playing: typeof p.gameextrainfo === "string" && p.gameextrainfo !== "" ? p.gameextrainfo : null,
  };
}

/**
 * The account's achievements in one game, or null when Steam has none to show:
 * the game has no achievements (400 "Requested app has no stats"), or is not
 * owned (403 "Profile is not public", even for a public profile). Only a
 * rejected key, a network failure or an unexpected answer throws.
 */
export async function fetchPlayerAchievements(
  { apiKey, steamId }: SteamCredentials,
  appId: number,
  signal?: AbortSignal,
): Promise<SteamAchievement[] | null> {
  const query = new URLSearchParams({ key: apiKey, steamid: steamId, appid: String(appId), l: "english", format: "json" });
  const response = await fetchWithTimeout(
    `${BASE_URL}/ISteamUserStats/GetPlayerAchievements/v1/?${query}`,
    { method: "GET", headers: { Accept: "application/json" } },
    signal,
  );
  type Answer = { playerstats?: { success?: boolean; error?: string; achievements?: unknown[] } };
  let data: Answer | null = null;
  try {
    data = (await response.json()) as Answer;
  } catch {
    // A rejected key answers with an HTML page; handled below by the status.
  }
  const stats = data?.playerstats;
  if (stats && (stats.success === false || typeof stats.error === "string")) return null;
  if (!response.ok) throw new SteamError(statusToFailure(response.status), response.status);
  if (!stats) throw new SteamError("other", response.status);
  return Array.isArray(stats.achievements) ? stats.achievements.filter(isAchievement) : null;
}

function isAchievement(value: unknown): value is SteamAchievement {
  if (typeof value !== "object" || value === null) return false;
  const a = value as Record<string, unknown>;
  return typeof a.apiname === "string" && typeof a.achieved === "number" && typeof a.unlocktime === "number";
}

function isOwnedGame(value: unknown): value is SteamOwnedGame {
  if (typeof value !== "object" || value === null) return false;
  const g = value as Record<string, unknown>;
  return typeof g.appid === "number" && typeof g.name === "string" && typeof g.playtime_forever === "number";
}

async function steamGet<T>(path: string, params: Record<string, string>, signal?: AbortSignal): Promise<T> {
  const query = new URLSearchParams({ ...params, format: "json" });
  const response = await fetchWithTimeout(`${BASE_URL}/${path}/?${query}`, { method: "GET", headers: { Accept: "application/json" } }, signal);
  if (!response.ok) throw new SteamError(statusToFailure(response.status), response.status);
  try {
    return (await response.json()) as T;
  } catch {
    throw new SteamError("other", response.status);
  }
}

function statusToFailure(status: number): SteamFailure {
  return status === 401 || status === 403 ? "unauthorized" : "other";
}
