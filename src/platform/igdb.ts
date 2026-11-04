/**
 * IGDB API client (https://api-docs.igdb.com). IGDB is reached with a Twitch
 * app access token obtained with the client-credentials grant from the
 * user's Twitch Client ID and Client Secret (Podešavanja).
 */
import { gameByIdQuery, searchQuery, timeToBeatQuery, type IgdbGame, type IgdbTimeToBeat } from "../domain/igdb";
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

export function searchIgdbGames(auth: IgdbAuth, query: string, signal?: AbortSignal): Promise<IgdbGame[]> {
  return igdbQuery<IgdbGame>(auth, "games", searchQuery(query), signal);
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
