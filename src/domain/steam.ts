/**
 * Steam playtime import. Steam's Web API knows one running total per game
 * (minutes, `playtime_forever`) and when it was last played; the app logs
 * sessions. The import adds one session per game for the hours Steam has
 * that the log does not, so the schedule keeps projecting from the sum of
 * sessions and nothing logged by hand is touched. This module is pure; the
 * network side lives in `platform/steam.ts`.
 */
import { localIsoDate, todayIso } from "./dates";
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
  const link = game.details?.storeLinks.find((l) => l.store === "Steam");
  if (!link) return null;
  const match = /\/app\/(\d+)(?:[/?#]|$)/.exec(link.url);
  return match ? Number(match[1]) : null;
}

/** Minutes to hours with one decimal (90 → 1.5, 7 → 0.1). */
export function minutesToHours(minutes: number): number {
  return Math.round(minutes / 6) / 10;
}

/**
 * Work out what an import would do. Only PC games can be on Steam. A game
 * whose IGDB details link a Steam app matches that app and nothing else; a
 * game without such a link matches by a title that equals exactly one owned
 * game once punctuation and case are ignored. Anything less certain stays
 * unmatched rather than guessed.
 */
export function planSteamImport(
  games: readonly Game[],
  sessions: readonly PlaySession[],
  owned: readonly SteamOwnedGame[],
  today: string = todayIso(),
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
    const appId = steamAppIdOf(game);
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
