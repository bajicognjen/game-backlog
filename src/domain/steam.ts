/**
 * Steam playtime import. Steam's Web API knows one running total per game
 * (minutes, `playtime_forever`) and when it was last played; the app logs
 * sessions. The import adds one session per game for the hours Steam has
 * that the log does not, so the schedule keeps projecting from the sum of
 * sessions and nothing logged by hand is touched. This module is pure; the
 * network side lives in `platform/steam.ts`.
 */
import { localIsoDate, todayIso } from "./dates";
import type { StoreLink } from "./details";
import type { SteamStoreItem } from "./steamStore";
import { normaliseTitle } from "./igdb";
import { hoursPlayedOf } from "./sessions";
import type { Game, PlaySession, Settings } from "./types";

/** One row of `IPlayerService/GetOwnedGames` (with `include_appinfo`). */
export interface SteamOwnedGame {
  appid: number;
  name: string;
  /** Minutes, across every platform Steam runs on. */
  playtime_forever: number;
  /** Unix seconds of the last launch; 0 or missing when Steam has no record. */
  rtime_last_played?: number | null;
  /** Minutes played in the last two weeks; missing when none. */
  playtime_2weeks?: number | null;
}

/** The note every imported session carries, so they stand out in the log. */
export const STEAM_IMPORT_NOTE = "Imported from Steam";

/** Differences below this many hours (six minutes) are not worth a session. */
export const MIN_IMPORT_HOURS = 0.1;

/** How a library game was tied to a Steam app: through IGDB's store link, or by an identical title. */
export type SteamMatchBy = "store" | "title";

export interface SteamMatch {
  game: Game;
  steam: SteamOwnedGame;
  matchedBy: SteamMatchBy;
  /** Steam's total in hours, one decimal. */
  steamHours: number;
  /** Sum of the game's logged sessions. */
  loggedHours: number;
}

/** A matched game whose Steam total exceeds its log, and the session that closes the gap. */
export interface SteamImportItem extends SteamMatch {
  /** Hours to add, one decimal, at least `MIN_IMPORT_HOURS`. */
  hours: number;
  /** When Steam last saw the game played; today when Steam has no date, or a future one. */
  playedOn: string;
  /**
   * Not started in the plan and nothing logged: Steam's total is lifetime,
   * so these hours most likely come from earlier play (a first run before a
   * replay, an abandoned attempt). Importing them would shrink the game's
   * slot in the plan, so the preview leaves it out unless chosen.
   */
  notStarted: boolean;
}

/** Games the preview starts with unticked: those not started, whose Steam hours likely predate the plan. */
export function excludedByDefault(items: readonly SteamImportItem[]): Set<number> {
  return new Set(items.filter((item) => item.notStarted).map((item) => item.game.id));
}

/** Library games Steam counts under one app, so their hours cannot be split. */
export interface SteamSharedApp {
  steam: SteamOwnedGame;
  games: Game[];
}

export interface SteamImportPlan {
  /** Games that would get a session, in library order. */
  items: SteamImportItem[];
  /** Matched games whose log already covers Steam's total. */
  upToDate: SteamMatch[];
  /** Matched games with more hours logged than Steam counts; they keep their log. */
  ahead: SteamMatch[];
  /** Steam apps that several library games point at. */
  shared: SteamSharedApp[];
  /** PC games Steam does not list: not owned there (IGDB's Steam app among them), or not linked and named differently. */
  unmatched: Game[];
}

/** The Steam app id behind the game's IGDB store link, e.g. 292030 from `https://store.steampowered.com/app/292030`. */
export function steamAppIdOf(game: Pick<Game, "details">): number | null {
  return steamAppIdIn(game.details?.storeLinks ?? []);
}

/** The Steam app id among some store links, or null without a usable Steam link. */
export function steamAppIdIn(links: readonly StoreLink[]): number | null {
  const link = links.find((l) => l.store === "Steam");
  if (!link) return null;
  const match = /\/app\/(\d+)(?:[/?#]|$)/.exec(link.url);
  return match ? Number(match[1]) : null;
}

/**
 * IGDB ids of the PC games whose cached details have no Steam link. Some are
 * editions cached before they borrowed their base game's links; asking IGDB
 * for those base games' links lets the import match them (see `baseGameAppIds`).
 */
export function editionCandidates(games: readonly Game[]): number[] {
  return games
    .filter((g) => g.platform === "pc" && g.source === "igdb" && g.externalId !== null && steamAppIdOf(g) === null)
    .map((g) => g.externalId as number);
}

/** Library game id → the Steam app of its base game, from the links IGDB returned per IGDB id. */
export function baseGameAppIds(games: readonly Game[], linksByIgdbId: ReadonlyMap<number, readonly StoreLink[]>): Map<number, number> {
  const appIds = new Map<number, number>();
  for (const game of games) {
    if (game.source !== "igdb" || game.externalId === null) continue;
    const links = linksByIgdbId.get(game.externalId);
    const appId = links ? steamAppIdIn(links) : null;
    if (appId !== null) appIds.set(game.id, appId);
  }
  return appIds;
}

/** Minutes to hours with one decimal (90 → 1.5, 7 → 0.1). */
export function minutesToHours(minutes: number): number {
  return Math.round(minutes / 6) / 10;
}

/**
 * Work out what an import would do. Only PC games can be on Steam. A game
 * whose IGDB details link a Steam app, or whose base game's do (an edition,
 * from `baseAppIds`), matches that app and nothing else; a game without such
 * a link matches by a title that equals exactly one owned game once
 * punctuation and case are ignored. Anything less certain stays unmatched
 * rather than guessed.
 */
export function planSteamImport(
  games: readonly Game[],
  sessions: readonly PlaySession[],
  owned: readonly SteamOwnedGame[],
  today: string = todayIso(),
  baseAppIds: ReadonlyMap<number, number> = new Map(),
): SteamImportPlan {
  const byAppId = new Map(owned.map((g) => [g.appid, g]));
  const byTitle = new Map<string, SteamOwnedGame | null>();
  for (const g of owned) {
    const key = normaliseTitle(g.name);
    if (key === "") continue;
    // A second owned game with the same name makes the title ambiguous.
    byTitle.set(key, byTitle.has(key) ? null : g);
  }

  const candidates = games.filter((g) => g.platform === "pc");
  const unmatched: Game[] = [];
  const matches: { game: Game; steam: SteamOwnedGame; matchedBy: SteamMatchBy }[] = [];
  for (const game of candidates) {
    const appId = steamAppIdOf(game) ?? baseAppIds.get(game.id) ?? null;
    if (appId !== null) {
      // IGDB names the exact Steam app. When it is not owned, an owned game with
      // the same title is another release (the original of a remake, or the
      // remake of an original), so the title is not tried.
      const byStore = byAppId.get(appId);
      if (byStore) matches.push({ game, steam: byStore, matchedBy: "store" });
      else unmatched.push(game);
      continue;
    }
    const byName = byTitle.get(normaliseTitle(game.title));
    if (byName) matches.push({ game, steam: byName, matchedBy: "title" });
    else unmatched.push(game);
  }

  // Hours Steam counts under one app cannot be split between two library games.
  const perApp = new Map<number, typeof matches>();
  for (const match of matches) {
    const list = perApp.get(match.steam.appid) ?? [];
    list.push(match);
    perApp.set(match.steam.appid, list);
  }
  const shared: SteamSharedApp[] = [];
  const plan: SteamImportPlan = { items: [], upToDate: [], ahead: [], shared, unmatched };
  for (const match of matches) {
    const group = perApp.get(match.steam.appid) ?? [];
    if (group.length > 1) {
      if (group[0] === match) shared.push({ steam: match.steam, games: group.map((m) => m.game) });
      continue;
    }
    const steamHours = minutesToHours(match.steam.playtime_forever);
    const loggedHours = hoursPlayedOf(sessions, match.game.id);
    const full: SteamMatch = { ...match, steamHours, loggedHours };
    // Compared at two decimals so floating-point noise around six minutes does not decide.
    const gap = Math.round((steamHours - loggedHours) * 100) / 100;
    if (gap >= MIN_IMPORT_HOURS) {
      plan.items.push({
        ...full,
        hours: Math.round(gap * 10) / 10,
        playedOn: lastPlayedOn(match.steam, today),
        notStarted: match.game.status === "pending" && loggedHours === 0,
      });
    } else if (gap <= -MIN_IMPORT_HOURS) {
      plan.ahead.push(full);
    } else {
      plan.upToDate.push(full);
    }
  }
  return plan;
}

/**
 * Steam's last-played day, never later than today; today when Steam has none.
 * Steam records a moment, so it is read on the local calendar like `today`:
 * in UTC, a game played just after midnight would land on the day before.
 */
export function lastPlayedOn(steam: Pick<SteamOwnedGame, "rtime_last_played">, today: string): string {
  const seconds = steam.rtime_last_played;
  if (!seconds || !Number.isFinite(seconds)) return today;
  const iso = localIsoDate(new Date(seconds * 1000));
  return iso <= today ? iso : today;
}

/** Total hours the chosen items would add. */
export function importedHours(items: readonly SteamImportItem[]): number {
  return Math.round(items.reduce((sum, item) => sum + item.hours, 0) * 10) / 10;
}

/** True when both Settings fields hold something usable; whether Steam accepts them shows on the first import. */
export function steamConfigured(settings: Pick<Settings, "steamApiKey" | "steamId">): boolean {
  return settings.steamApiKey.trim() !== "" && parseSteamIdInput(settings.steamId) !== null;
}

export type SteamIdInput = { kind: "id"; steamId: string } | { kind: "vanity"; name: string };

/**
 * Read the Steam account from what the user typed: a SteamID64 (17 digits),
 * a profile URL of either form, or a bare custom URL name that still needs
 * resolving through the API. Null when it is none of those.
 */
export function parseSteamIdInput(text: string): SteamIdInput | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (/^\d{17}$/.test(trimmed)) return { kind: "id", steamId: trimmed };
  // Digits alone can only mean an id, and a SteamID64 has 17 of them.
  if (/^\d+$/.test(trimmed)) return null;
  const profile = /steamcommunity\.com\/profiles\/(\d{17})(?:[/?#]|$)/i.exec(trimmed);
  if (profile) return { kind: "id", steamId: profile[1] };
  const custom = /steamcommunity\.com\/id\/([^/?#\s]+)/i.exec(trimmed);
  if (custom) return { kind: "vanity", name: custom[1] };
  if (/^[A-Za-z0-9_-]{2,32}$/.test(trimmed)) return { kind: "vanity", name: trimmed };
  return null;
}

/** The Steam games the app does not have yet, for picking the ones worth planning. */
export interface SteamLibrary {
  /** Never played on Steam: the real backlog. By name. */
  notPlayed: SteamOwnedGame[];
  /** Started on Steam but never added to the app. Most recently played first. */
  played: SteamOwnedGame[];
  /** Set aside with "Hide" (not to be planned). By name. */
  hidden: SteamOwnedGame[];
}

/**
 * Owned Steam games that are not in the app yet, on any platform. A game is
 * "in the app" on the same terms the import matches it: through its Steam
 * store link (or its base game's, from `baseAppIds`) when it has one,
 * otherwise through an identical title.
 */
export function steamLibrary(
  games: readonly Game[],
  owned: readonly SteamOwnedGame[],
  hiddenAppIds: readonly number[],
  baseAppIds: ReadonlyMap<number, number> = new Map(),
): SteamLibrary {
  const inApp = inAppTest(games, baseAppIds);
  const hidden = new Set(hiddenAppIds);
  const byName = (a: SteamOwnedGame, b: SteamOwnedGame) => a.name.localeCompare(b.name);
  const library: SteamLibrary = { notPlayed: [], played: [], hidden: [] };
  for (const steam of owned) {
    if (inApp(steam.appid, steam.name)) continue;
    if (hidden.has(steam.appid)) library.hidden.push(steam);
    else if (steam.playtime_forever > 0) library.played.push(steam);
    else library.notPlayed.push(steam);
  }
  library.notPlayed.sort(byName);
  library.hidden.sort(byName);
  library.played.sort((a, b) => (b.rtime_last_played ?? 0) - (a.rtime_last_played ?? 0) || b.playtime_forever - a.playtime_forever || byName(a, b));
  return library;
}

/**
 * Whether a Steam app is already in the app, on any platform: through a
 * game's Steam store link (or its base game's) when it has one, otherwise
 * through an identical title, as the import matches.
 */
function inAppTest(games: readonly Game[], baseAppIds: ReadonlyMap<number, number>): (appid: number, name: string) => boolean {
  const linkedApps = new Set<number>();
  const unlinkedTitles = new Set<string>();
  for (const game of games) {
    const appId = steamAppIdOf(game) ?? baseAppIds.get(game.id) ?? null;
    if (appId !== null) linkedApps.add(appId);
    else unlinkedTitles.add(normaliseTitle(game.title));
  }
  return (appid, name) => linkedApps.has(appid) || unlinkedTitles.has(normaliseTitle(name));
}

/** A wishlisted game with its store data (null when Steam has no store page for it any more). */
export interface SteamWishlistEntry {
  appid: number;
  name: string;
  /** The owner's own ranking; 0 when unranked. */
  priority: number;
  /** Unix seconds. */
  dateAdded: number;
  store: SteamStoreItem | null;
}

/**
 * The wishlist minus games already in the app, split from the hidden ones.
 * Ranked games first in the owner's order, then the rest newest first.
 */
export function steamWishlist(
  games: readonly Game[],
  entries: readonly SteamWishlistEntry[],
  hiddenAppIds: readonly number[],
  baseAppIds: ReadonlyMap<number, number> = new Map(),
): { wishlist: SteamWishlistEntry[]; hidden: SteamWishlistEntry[] } {
  const inApp = inAppTest(games, baseAppIds);
  const hidden = new Set(hiddenAppIds);
  const open = entries.filter((e) => !inApp(e.appid, e.name));
  const rank = (e: SteamWishlistEntry) => (e.priority > 0 ? e.priority : Number.MAX_SAFE_INTEGER);
  return {
    wishlist: open.filter((e) => !hidden.has(e.appid)).sort((a, b) => rank(a) - rank(b) || b.dateAdded - a.dateAdded),
    hidden: open.filter((e) => hidden.has(e.appid)).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** A Steam name made fit for an IGDB search: trademark signs dropped, spaces tidied. */
export function steamSearchTitle(name: string): string {
  return name.replace(/[™®©]/g, "").replace(/\s+/g, " ").trim();
}

/** The local day a Steam game was last played, or null when Steam has no date. */
export function lastPlayedDay(steam: Pick<SteamOwnedGame, "rtime_last_played">): string | null {
  const seconds = steam.rtime_last_played;
  return seconds && Number.isFinite(seconds) ? localIsoDate(new Date(seconds * 1000)) : null;
}

/** The hidden list as stored in Settings (JSON); anything unreadable counts as an empty list. */
export function parseHiddenApps(text: string | null | undefined): number[] {
  if (!text) return [];
  try {
    const value: unknown = JSON.parse(text);
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((id): id is number => Number.isInteger(id) && id > 0))];
  } catch {
    return [];
  }
}
