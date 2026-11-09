/**
 * Finish dates from Steam achievements. Many games have an achievement for
 * beating the story ("Finish the main story", "Watched the ending credits");
 * its unlock time is when the game was finished. Story achievements are often
 * hidden, and Steam blanks a hidden achievement's description, so when none is
 * recognised the newest unlocked achievement is offered instead, labelled as
 * just that. This module is pure; the request lives in `platform/steam.ts`.
 */
import { localIsoDate } from "./dates";

/** One row of `ISteamUserStats/GetPlayerAchievements` (with `l=english`). */
export interface SteamAchievement {
  apiname: string;
  /** 1 when unlocked. */
  achieved: number;
  /** Unix seconds of the unlock; 0 while locked. */
  unlocktime: number;
  name?: string | null;
  /** Empty for hidden achievements. */
  description?: string | null;
}

export interface UnlockedAchievement {
  name: string;
  description: string;
  /** Local day of the unlock, 'YYYY-MM-DD'. */
  day: string;
  /** Unix seconds, for ordering. */
  unlockedAt: number;
}

export type FinishHint =
  /** The recognised ending achievement is unlocked: the game was finished that day. */
  | { kind: "ending"; achievement: UnlockedAchievement }
  /** The recognised ending achievement is still locked: Steam has not seen the ending. */
  | { kind: "endingLocked"; name: string; description: string }
  /** No ending recognised; the newest unlocked achievement, often the last story beat. */
  | { kind: "latest"; achievement: UnlockedAchievement }
  /** Nothing unlocked, or no achievements at all. */
  | { kind: "none" };

/** Words that say the story, game or campaign was completed, or its ending or credits reached. */
const ENDING: readonly RegExp[] = [
  /\b(complete[ds]?|completing|finish(e[ds])?|finishing|beat(en)?|beating|clear(ed)?)\b.{0,40}\b(story|game|campaign|adventure|journey|final (mission|chapter|level|act|boss))\b/,
  /\b(roll(ed)?|see|saw|watch(ed)?|reach(ed)?)\b.{0,20}\bcredits\b/,
  /\b(an|the|good|true|final|bad) ending\b/,
  /\bdefeat(ed)? the final boss\b/,
];

/** Harder or longer variants of finishing: a second run, a difficulty, a challenge, everything. */
const VARIANT: readonly RegExp[] = [
  /new game ?(\+|plus)|\bng ?\+/,
  /\bon (?!any\b)[a-z' -]{1,30} (difficulty|mode)\b/,
  /\b(hard(er|est)?|nightmare|insane|expert|legendary|hardcore|grounded|permadeath|ironman|one life)\b/,
  /\b100 ?%|\ball (the )?(endings|chapters|missions|levels|stories|quests)\b|\bevery\b/,
  /\b(without|no (damage|deaths?|kills)|under \d|within \d|less than \d|speed ?run|twice|co-?op|online)\b/,
];

function text(a: SteamAchievement): string {
  return `${a.name ?? ""} ${a.description ?? ""}`.toLowerCase();
}

/** True for an achievement that marks beating the game in its plain form. */
export function isEndingAchievement(a: SteamAchievement): boolean {
  const t = text(a);
  return ENDING.some((p) => p.test(t)) && !VARIANT.some((p) => p.test(t));
}

function unlocked(a: SteamAchievement): UnlockedAchievement {
  return {
    name: (a.name ?? a.apiname).trim(),
    description: (a.description ?? "").trim(),
    day: localIsoDate(new Date(a.unlocktime * 1000)),
    unlockedAt: a.unlocktime,
  };
}

/** Unlocked achievements, newest first. */
export function unlockedNewestFirst(list: readonly SteamAchievement[]): UnlockedAchievement[] {
  return list
    .filter((a) => a.achieved === 1 && a.unlocktime > 0)
    .sort((a, b) => b.unlocktime - a.unlocktime)
    .map(unlocked);
}

/**
 * What Steam says about when the game was finished. When several ending
 * achievements are unlocked (different endings), the earliest is the first
 * time the game was beaten.
 */
export function finishHint(list: readonly SteamAchievement[]): FinishHint {
  const endings = list.filter(isEndingAchievement);
  const first = endings.filter((a) => a.achieved === 1 && a.unlocktime > 0).sort((a, b) => a.unlocktime - b.unlocktime)[0];
  if (first) return { kind: "ending", achievement: unlocked(first) };
  if (endings.length > 0) {
    const e = endings[0];
    return { kind: "endingLocked", name: (e.name ?? e.apiname).trim(), description: (e.description ?? "").trim() };
  }
  const latest = unlockedNewestFirst(list)[0];
  return latest ? { kind: "latest", achievement: latest } : { kind: "none" };
}
