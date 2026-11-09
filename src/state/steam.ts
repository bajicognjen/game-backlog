/**
 * What the Steam dialogs (import, library) load first: the owned games and,
 * for editions cached without a Steam link, the Steam app of their base game.
 */
import { useEffect, useState } from "react";
import type { SteamAchievement } from "../domain/achievements";
import { todayIso } from "../domain/dates";
import {
  baseGameAppIds,
  editionCandidates,
  planSteamImport,
  steamAppIdOf,
  steamConfigured,
  type SteamOwnedGame,
  type SteamWishlistEntry,
} from "../domain/steam";
import type { SteamStoreItem } from "../domain/steamStore";
import type { Game, Settings } from "../domain/types";
import { t } from "../i18n/en";
import { SteamError, fetchOwnedGames, fetchPlayerAchievements, fetchStoreItems, fetchWishlist, resolveSteamId, type SteamFailure } from "../platform/steam";
import { providers } from "./providers";
import { useStore } from "./store";

export interface SteamSnapshot {
  owned: SteamOwnedGame[];
  /** Library game id → its base game's Steam app (see `baseGameAppIds`). */
  baseApps: Map<number, number>;
}

/** Ask Steam for the account's games with the key and account in Settings. Throws a `SteamError` or `ProviderError`. */
export async function loadSteam(signal: AbortSignal): Promise<SteamSnapshot> {
  const { settings, games } = useStore.getState();
  const apiKey = settings.steamApiKey.trim();
  if (apiKey === "") throw new SteamError("no-credentials");
  const steamId = await steamIdFor(settings, signal);
  const owned = await fetchOwnedGames({ apiKey, steamId }, signal);
  const baseApps = await lookUpBaseApps(games, settings, signal);
  const snapshot = { owned, baseApps };
  recent = { at: Date.now(), account: accountKey(settings), snapshot };
  for (const listener of listeners) listener(snapshot);
  return snapshot;
}

/** How long a loaded library is reused for quick lookups (finish and status hints); the Steam dialogs always load fresh. */
const RECENT_MS = 10 * 60_000;
let recent: { at: number; account: string; snapshot: SteamSnapshot } | null = null;
const listeners = new Set<(snapshot: SteamSnapshot) => void>();

function accountKey(settings: Pick<Settings, "steamApiKey" | "steamId">): string {
  return `${settings.steamApiKey.trim()}|${settings.steamId.trim()}`;
}

async function recentSteam(signal: AbortSignal): Promise<SteamSnapshot> {
  const account = accountKey(useStore.getState().settings);
  if (recent && recent.account === account && Date.now() - recent.at < RECENT_MS) return recent.snapshot;
  return loadSteam(signal);
}

/**
 * The account's Steam library for passive views (the status hints): loaded
 * once when Steam is set up, then whatever the Steam dialogs load later.
 * Null until it arrives, and when Steam is not set up or cannot be reached.
 */
export function useRecentSteam(): SteamSnapshot | null {
  const account = useStore((s) => (steamConfigured(s.settings) ? accountKey(s.settings) : null));
  const [snapshot, setSnapshot] = useState<SteamSnapshot | null>(() => (recent && recent.account === account ? recent.snapshot : null));

  useEffect(() => {
    if (account === null) {
      setSnapshot(null);
      return;
    }
    const controller = new AbortController();
    listeners.add(setSnapshot);
    recentSteam(controller.signal)
      .then((loaded) => {
        if (!controller.signal.aborted) setSnapshot(loaded);
      })
      .catch(() => {
        // Optional: without Steam the plan simply shows no hints.
      });
    return () => {
      controller.abort();
      listeners.delete(setSnapshot);
    };
  }, [account]);

  return snapshot;
}

/** The Steam app a library game is, on the import's terms (its own link first); null when Steam does not list it. */
async function steamAppFor(game: Game, signal: AbortSignal): Promise<number | null> {
  const linked = steamAppIdOf(game);
  if (linked !== null) return linked;
  const { owned, baseApps } = await recentSteam(signal);
  const plan = planSteamImport([game], [], owned, todayIso(), baseApps);
  return [...plan.items, ...plan.upToDate, ...plan.ahead][0]?.steam.appid ?? null;
}

/**
 * A game's Steam achievements, or null when Steam has none for it (not on
 * Steam, not owned there, or without achievements). Throws like `loadSteam`.
 */
export async function loadAchievementsFor(game: Game, signal: AbortSignal): Promise<SteamAchievement[] | null> {
  const { settings } = useStore.getState();
  const apiKey = settings.steamApiKey.trim();
  if (apiKey === "") throw new SteamError("no-credentials");
  const appId = await steamAppFor(game, signal);
  if (appId === null) return null;
  const cacheKey = `${accountKey(settings)}|${appId}`;
  const cached = achievementCache.get(cacheKey);
  if (cached && Date.now() - cached.at < RECENT_MS) return cached.list;
  const steamId = await steamIdFor(settings, signal);
  const list = await fetchPlayerAchievements({ apiKey, steamId }, appId, signal);
  achievementCache.set(cacheKey, { at: Date.now(), list });
  return list;
}

/** Achievements per account and app, reused like the library so the hints bar and the Finish dialog share one request. */
const achievementCache = new Map<string, { at: number; list: SteamAchievement[] | null }>();

/** The SteamID64 behind the saved account; a custom URL name is resolved once per account, not per request. */
const resolvedIds = new Map<string, string>();

async function steamIdFor(settings: Pick<Settings, "steamApiKey" | "steamId">, signal: AbortSignal): Promise<string> {
  const account = accountKey(settings);
  const known = resolvedIds.get(account);
  if (known) return known;
  const steamId = await resolveSteamId(settings.steamApiKey.trim(), settings.steamId, signal);
  resolvedIds.set(account, steamId);
  return steamId;
}

/**
 * Achievements of the given games (the ones in progress or paused, for the
 * "finished" hints), by game id; games Steam has none for are left out.
 * Loads in the background and quietly stays empty when Steam cannot be reached.
 */
export function useSteamAchievements(games: readonly Game[]): Map<number, SteamAchievement[]> {
  const account = useStore((s) => (steamConfigured(s.settings) ? accountKey(s.settings) : null));
  const ids = games.map((g) => g.id).join(",");
  const [byGame, setByGame] = useState<Map<number, SteamAchievement[]>>(() => new Map());

  useEffect(() => {
    if (account === null || ids === "") {
      setByGame(new Map());
      return;
    }
    const controller = new AbortController();
    void (async () => {
      const next = new Map<number, SteamAchievement[]>();
      for (const game of games) {
        try {
          const list = await loadAchievementsFor(game, controller.signal);
          if (list) next.set(game.id, list);
        } catch {
          if (controller.signal.aborted) return;
          // One game Steam cannot answer for does not hide the others' hints.
        }
      }
      if (!controller.signal.aborted) setByGame(next);
    })();
    return () => controller.abort();
    // Keyed by the games' ids: the objects are replaced on every reload.
  }, [account, ids]);

  return byGame;
}

/**
 * Steam apps of the base games behind editions whose cached details have no
 * Steam link. Optional like all IGDB enrichment: without IGDB set up, or
 * when it fails, those games just fall back to their titles.
 */
async function lookUpBaseApps(games: readonly Game[], settings: Settings, signal: AbortSignal): Promise<Map<number, number>> {
  const ids = editionCandidates(games);
  if (ids.length === 0 || !providers.igdb.configured(settings)) return new Map();
  try {
    return baseGameAppIds(games, await providers.igdb.editionBaseLinks(ids, signal));
  } catch (error) {
    if (signal.aborted) throw error;
    return new Map();
  }
}

/** The account's wishlist with names and store data (the "From Steam" list's Wishlist view). Throws like `loadSteam`. */
export async function loadWishlist(signal: AbortSignal): Promise<SteamWishlistEntry[]> {
  const { settings } = useStore.getState();
  if (settings.steamApiKey.trim() === "") throw new SteamError("no-credentials");
  const items = await fetchWishlist(await steamIdFor(settings, signal), signal);
  const store = await fetchStoreItems(
    items.map((i) => i.appid),
    signal,
  );
  for (const item of store.values()) storeCache.set(item.appid, { at: Date.now(), item });
  return items.map((i) => {
    const s = store.get(i.appid) ?? null;
    return { appid: i.appid, name: s?.name ?? `App ${i.appid}`, priority: i.priority, dateAdded: i.dateAdded, store: s };
  });
}

/** Store data per app; it changes slowly and needs no key, so it is shared by every view for a while. */
const storeCache = new Map<number, { at: number; item: SteamStoreItem | null }>();

/**
 * Steam's store data for a game in the app (game details), or null when the
 * game is not on Steam. A game with a Steam link needs no key; one matched by
 * title needs the library, so only with Steam set up.
 */
export function useSteamStoreItem(game: Game | null): SteamStoreItem | null {
  const configured = useStore((s) => steamConfigured(s.settings));
  const [item, setItem] = useState<SteamStoreItem | null>(null);
  const gameId = game?.id ?? null;

  useEffect(() => {
    setItem(null);
    if (!game) return;
    const controller = new AbortController();
    void (async () => {
      try {
        const appId = steamAppIdOf(game) ?? (configured && game.platform === "pc" ? await steamAppFor(game, controller.signal) : null);
        if (appId === null || controller.signal.aborted) return;
        const cached = storeCache.get(appId);
        let found = cached && Date.now() - cached.at < RECENT_MS ? cached.item : undefined;
        if (found === undefined) {
          found = (await fetchStoreItems([appId], controller.signal)).get(appId) ?? null;
          storeCache.set(appId, { at: Date.now(), item: found });
        }
        if (!controller.signal.aborted) setItem(found);
      } catch {
        // Optional: without Steam's answer the details simply show no Steam line.
      }
    })();
    return () => controller.abort();
    // Keyed by the game's id: the object is replaced on every reload.
  }, [gameId, configured]);

  return item;
}

/** What to tell the user when loading from Steam failed. */
export function steamFailureMessage(reason: SteamFailure): string {
  switch (reason) {
    case "no-credentials":
      return t.steam.errors.noCredentials;
    case "unauthorized":
      return t.steam.errors.unauthorized;
    case "unknown-account":
      return t.steam.errors.unknownAccount;
    case "private":
      return t.steam.errors.private;
    case "network":
      return t.steam.errors.network;
    default:
      return t.steam.errors.other;
  }
}
