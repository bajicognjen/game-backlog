/**
 * Steam Web API client (https://steamcommunity.com/dev). Requests carry the
 * user's Web API key; the key identifies the caller, not the account, so the
 * profile's "Game details" must be public for its games to come back.
 */
import { parseSteamIdInput, type SteamOwnedGame } from "../domain/steam";
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
