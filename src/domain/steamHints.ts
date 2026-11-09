/**
 * Status hints from Steam: a game in progress or paused whose ending
 * achievement is unlocked was probably finished; a planned game played lately
 * probably is in progress; a game in progress nobody has touched for a month
 * probably is paused. They are suggestions with a button; nothing changes on
 * its own.
 */
import { finishHint, type SteamAchievement, type UnlockedAchievement } from "./achievements";
import { MS_PER_DAY, parseIsoDate } from "./dates";
import { lastPlayedDay, minutesToHours, planSteamImport, type SteamOwnedGame } from "./steam";
import { isDone, type Game, type PlaySession } from "./types";

/** Hours in the last two weeks before a game not marked as in progress counts as being played (a quick launch does not). */
export const PLAYING_MIN_HOURS = 0.5;
/** Days without play, on Steam or in the log, before a game in progress counts as gone quiet. */
export const IDLE_DAYS = 30;

export type StatusHint =
  /** In progress or paused, and Steam has the ending achievement unlocked during this playthrough. */
  | { kind: "finished"; key: string; game: Game; achievement: UnlockedAchievement }
  /** Not started or paused, yet played on Steam in the last two weeks. */
  | { kind: "playing"; key: string; game: Game; hours: number }
  /** In progress, but neither Steam nor the log has seen it played for `days`. */
  | { kind: "idle"; key: string; game: Game; lastPlayed: string; days: number };

/**
 * Hints for the planned PC games Steam lists (matched like the import),
 * without the ones dismissed. A hint's key carries the moment it rests on (the
 * last play, the unlock), so a dismissed hint comes back only when that moves.
 * `currentSince` is when the current game started (the plan's start date): a
 * game made current a week ago is not quiet, whatever Steam last saw.
 * `achievements` holds the Steam achievements of the games in progress or
 * paused, by game id; without them there are no "finished" hints.
 */
export function statusHints(
  games: readonly Game[],
  sessions: readonly PlaySession[],
  owned: readonly SteamOwnedGame[],
  baseAppIds: ReadonlyMap<number, number>,
  today: string,
  dismissed: readonly string[],
  currentSince: string | null = null,
  achievements: ReadonlyMap<number, readonly SteamAchievement[]> = new Map(),
): StatusHint[] {
  const planned = games.filter((g) => !isDone(g));
  const plan = planSteamImport(planned, sessions, owned, today, baseAppIds);
  const hints: StatusHint[] = [];
  for (const { game, steam } of [...plan.items, ...plan.upToDate, ...plan.ahead]) {
    const finished = finishedInThisRun(game, sessions, achievements.get(game.id), currentSince);
    if (finished) {
      // A finished game needs finishing, not starting or pausing.
      hints.push({ kind: "finished", key: `finished:${game.id}:${finished.unlockedAt}`, game, achievement: finished });
      continue;
    }
    const recentHours = minutesToHours(steam.playtime_2weeks ?? 0);
    if ((game.status === "pending" || game.status === "paused") && recentHours >= PLAYING_MIN_HOURS) {
      hints.push({ kind: "playing", key: `playing:${game.id}:${steam.rtime_last_played ?? 0}`, game, hours: recentHours });
      continue;
    }
    if (game.status !== "in_progress" || (steam.playtime_2weeks ?? 0) > 0) continue;
    const steamDay = lastPlayedDay(steam);
    if (!steamDay) continue;
    const logDay = sessions.filter((s) => s.gameId === game.id).reduce((latest, s) => (s.playedOn > latest ? s.playedOn : latest), "");
    const lastPlayed = [steamDay, logDay, currentSince ?? ""].reduce((latest, day) => (day > latest ? day : latest));
    const days = Math.floor((parseIsoDate(today) - parseIsoDate(lastPlayed)) / MS_PER_DAY);
    if (days >= IDLE_DAYS) hints.push({ kind: "idle", key: `idle:${game.id}:${lastPlayed}`, game, lastPlayed, days });
  }
  const shown = hints.filter((h) => !dismissed.includes(h.key));
  // Finished games first (latest first), then games being played (most hours first), then quiet ones (longest first).
  return shown.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || weight(b) - weight(a));
}

const KIND_ORDER: Record<StatusHint["kind"], number> = { finished: 0, playing: 1, idle: 2 };

function weight(hint: StatusHint): number {
  if (hint.kind === "finished") return hint.achievement.unlockedAt;
  return hint.kind === "playing" ? hint.hours : hint.days;
}

/**
 * The ending achievement of a game in progress or paused, when it was unlocked
 * during this playthrough: not before the game became current, nor before its
 * first logged session. An ending from an earlier run (a replay) says nothing.
 * Only a recognised ending counts; the newest unlock alone is not proof.
 */
function finishedInThisRun(
  game: Game,
  sessions: readonly PlaySession[],
  achievements: readonly SteamAchievement[] | undefined,
  currentSince: string | null,
): UnlockedAchievement | null {
  if (!achievements || (game.status !== "in_progress" && game.status !== "paused")) return null;
  const hint = finishHint(achievements);
  if (hint.kind !== "ending") return null;
  const firstSession = sessions.filter((s) => s.gameId === game.id).reduce((first, s) => (first === "" || s.playedOn < first ? s.playedOn : first), "");
  const starts = [firstSession, game.status === "in_progress" ? (currentSince ?? "") : ""].filter((day) => day !== "");
  const runStart = starts.length > 0 ? starts.reduce((a, b) => (a < b ? a : b)) : "";
  return hint.achievement.day >= runStart ? hint.achievement : null;
}

/** The dismissed list to keep after dismissing `key`: only keys of hints still showing, so it never grows stale. */
export function dismissHint(dismissed: readonly string[], current: readonly StatusHint[], key: string): string[] {
  const live = new Set(current.map((h) => h.key));
  return [...dismissed.filter((k) => live.has(k) && k !== key), key];
}

/** The dismissed list as stored in Settings (JSON); anything unreadable counts as empty. */
export function parseDismissedHints(text: string | null | undefined): string[] {
  if (!text) return [];
  try {
    const value: unknown = JSON.parse(text);
    return Array.isArray(value) ? [...new Set(value.filter((k): k is string => typeof k === "string" && k !== ""))] : [];
  } catch {
    return [];
  }
}
