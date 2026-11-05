/**
 * IGDB API client (https://api-docs.igdb.com). IGDB is reached with a Twitch
 * app access token obtained with the client-credentials grant from the
 * user's Twitch Client ID and Client Secret (Settings).
 */
import { gameByIdQuery, searchQuery, timeToBeatQuery, type IgdbGame, type IgdbTimeToBeat, type SearchFilterVariant } from "../domain/igdb";
import { ProviderError, fetchWithTimeout, statusToFailure } from "./http";

const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const BASE_URL = "https://api.igdb.com/v4";

/** Refresh this long before the token actually expires. */
const EXPIRY_MARGIN_MS = 5 * 60_000;

export interface IgdbToken {
  accessToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

export interface IgdbAuth {
  clientId: string;
  accessToken: string;
}

export function tokenIsValid(token: Partial<IgdbToken> | null, now = Date.now()): token is IgdbToken {
  return !!token && typeof token.accessToken === "string" && token.accessToken !== "" && typeof token.expiresAt === "number" && token.expiresAt - EXPIRY_MARGIN_MS > now;
}

/**
 * Client-credentials grant: POST client_id, client_secret and grant_type;
 * Twitch answers with `access_token` and `expires_in` (seconds, ~60 days).
 */
export async function fetchAppAccessToken(clientId: string, clientSecret: string, signal?: AbortSignal, now = Date.now()): Promise<IgdbToken> {
  const body = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" });
  const response = await fetchWithTimeout(
    TOKEN_URL,
    { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" }, body: body.toString() },
    signal,
  );
  if (!response.ok) throw new ProviderError(response.status === 400 || response.status === 401 || response.status === 403 ? "unauthorized" : "other", response.status);
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!data.access_token || !data.expires_in) throw new ProviderError("other", response.status);
  return { accessToken: data.access_token, expiresAt: now + data.expires_in * 1000 };
}

/** POST an Apicalypse query to an IGDB endpoint. */
export async function igdbQuery<T>(auth: IgdbAuth, endpoint: string, body: string, signal?: AbortSignal): Promise<T[]> {
  const response = await fetchWithTimeout(
    `${BASE_URL}/${endpoint}`,
    {
      method: "POST",
      headers: { "Client-ID": auth.clientId, Authorization: `Bearer ${auth.accessToken}`, Accept: "application/json", "Content-Type": "text/plain" },
      body,
    },
    signal,
  );
  if (!response.ok) throw new ProviderError(statusToFailure(response.status), response.status);
  const data = (await response.json()) as unknown;
  return Array.isArray(data) ? (data as T[]) : [];
}

/** The filter variant IGDB accepted last time; a 400 on a field name moves to the next one. */
let searchVariant: SearchFilterVariant = "game_type";
const VARIANTS: SearchFilterVariant[] = ["game_type", "category", "none"];
export const SEARCH_LIMIT = 25;

export interface IgdbSearchOutcome {
  games: IgdbGame[];
  /** Which filter the results came through; "none" means unfiltered (field unsupported, or nothing matched the filter). */
  variant: SearchFilterVariant;
}

export async function searchIgdbGames(auth: IgdbAuth, query: string, includeAddons = false, signal?: AbortSignal): Promise<IgdbSearchOutcome> {
  for (let i = VARIANTS.indexOf(searchVariant); i < VARIANTS.length; i++) {
    const variant = VARIANTS[i];
    let games: IgdbGame[];
    try {
      games = await igdbQuery<IgdbGame>(auth, "games", searchQuery(query, SEARCH_LIMIT, variant, includeAddons), signal);
    } catch (error) {
      // 400 means IGDB rejected the query itself (an unknown field); anything else is a real failure.
      if (error instanceof ProviderError && error.status === 400 && i < VARIANTS.length - 1) continue;
      throw error;
    }
    searchVariant = variant;
    if (games.length > 0 || variant === "none") {
      if (import.meta.env.DEV) console.debug(`[igdb] search "${query}" via ${variant}${includeAddons ? "+addons" : ""}: ${games.length} rows`);
      return { games, variant };
    }
    // Nothing passed the type filter: show whatever IGDB has rather than an empty list.
    const unfiltered = await igdbQuery<IgdbGame>(auth, "games", searchQuery(query, SEARCH_LIMIT, "none"), signal);
    if (import.meta.env.DEV) console.debug(`[igdb] search "${query}" via ${variant} empty, unfiltered: ${unfiltered.length} rows`);
    return { games: unfiltered, variant: "none" };
  }
  return { games: [], variant: "none" };
}

export async function getIgdbGame(auth: IgdbAuth, id: number, signal?: AbortSignal): Promise<IgdbGame | null> {
  const games = await igdbQuery<IgdbGame>(auth, "games", gameByIdQuery(id), signal);
  return games[0] ?? null;
}

/** Typical completion time in seconds ("normally"), or null when IGDB has none. */
export async function getIgdbTimeToBeat(auth: IgdbAuth, gameId: number, signal?: AbortSignal): Promise<number | null> {
  try {
    const rows = await igdbQuery<IgdbTimeToBeat>(auth, "game_time_to_beats", timeToBeatQuery(gameId), signal);
    return rows[0]?.normally ?? null;
  } catch (error) {
    if (signal?.aborted) throw error;
    return null; // Optional data: a failure here must not block the pick.
  }
}
