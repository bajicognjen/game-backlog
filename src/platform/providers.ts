/**
 * Game databases behind one interface. IGDB is the only one today; a new
 * source only needs a mapping module, a client and an entry in `createProviders`.
 */
import { storeLinksFrom, type StoreLink } from "../domain/details";
import { mapIgdbGame, mapIgdbSearchResult, rankSearchHits } from "../domain/igdb";
import type { GameMetadata, SearchHit } from "../domain/provider";
import type { GameSource, Settings } from "../domain/types";
import { ProviderError } from "./http";
import {
  fetchAppAccessToken,
  getIgdbGame,
  getIgdbTimeToBeat,
  getIgdbVersionParentLinks,
  searchIgdbGames,
  tokenIsValid,
  type IgdbAuth,
  type IgdbToken,
} from "./igdb";

export interface GameProvider {
  source: GameSource;
  /** True when the settings hold what this provider needs. */
  configured(settings: Settings): boolean;
  search(query: string, options?: SearchOptions, signal?: AbortSignal): Promise<SearchHit[]>;
  details(externalId: number, signal?: AbortSignal): Promise<GameMetadata>;
  /**
   * Store links of the base game behind each id that is an edition, for
   * details cached before editions borrowed them; other ids are left out.
   */
  editionBaseLinks(externalIds: readonly number[], signal?: AbortSignal): Promise<Map<number, StoreLink[]>>;
}

export interface SearchOptions {
  /** Also list DLC, expansions, episodes and packs. */
  includeAddons?: boolean;
}

export interface ProviderDeps {
  getSettings(): Settings;
  /** Persist a freshly issued Twitch token so it is reused until it expires. */
  rememberIgdbToken(token: IgdbToken): Promise<void>;
}

export function createIgdbProvider(deps: ProviderDeps): GameProvider {
  let pending: Promise<IgdbAuth> | null = null;

  /** A valid auth header pair, requesting a new token only when the cached one is missing or about to expire. */
  function auth(signal?: AbortSignal): Promise<IgdbAuth> {
    const settings = deps.getSettings();
    const clientId = settings.igdbClientId.trim();
    const clientSecret = settings.igdbClientSecret.trim();
    if (clientId === "" || clientSecret === "") return Promise.reject(new ProviderError("no-credentials"));
    const cached = { accessToken: settings.igdbAccessToken, expiresAt: settings.igdbTokenExpiresAt };
    if (tokenIsValid(cached)) return Promise.resolve({ clientId, accessToken: cached.accessToken });
    if (!pending) {
      pending = (async () => {
        try {
          const token = await fetchAppAccessToken(clientId, clientSecret, signal);
          await deps.rememberIgdbToken(token);
          return { clientId, accessToken: token.accessToken };
        } finally {
          pending = null;
        }
      })();
    }
    return pending;
  }

  return {
    source: "igdb",
    configured: (settings) => settings.igdbClientId.trim() !== "" && settings.igdbClientSecret.trim() !== "",
    async search(query, options, signal) {
      const { games } = await searchIgdbGames(await auth(signal), query, options?.includeAddons ?? false, signal);
      return rankSearchHits(games.map(mapIgdbSearchResult), query);
    },
    async details(externalId, signal) {
      const a = await auth(signal);
      const [game, normally] = await Promise.all([getIgdbGame(a, externalId, signal), getIgdbTimeToBeat(a, externalId, signal)]);
      if (!game) throw new ProviderError("other", 404);
      return mapIgdbGame(game, normally);
    },
    async editionBaseLinks(externalIds, signal) {
      if (externalIds.length === 0) return new Map();
      const urls = await getIgdbVersionParentLinks(await auth(signal), externalIds, signal);
      return new Map([...urls].map(([id, list]) => [id, storeLinksFrom(list.map((url) => ({ url })))]));
    },
  };
}

export function createProviders(deps: ProviderDeps): Record<GameSource, GameProvider> {
  return { igdb: createIgdbProvider(deps) };
}

/** The provider the search box uses. */
export function primaryProvider(providers: Record<GameSource, GameProvider>): GameProvider {
  return providers.igdb;
}
