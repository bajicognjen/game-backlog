import { completedGames } from "./schedule";
import type { Game, GameType, Genre, PlaySession } from "./types";

export interface MonthBucket {
  /** 'YYYY-MM'. */
  month: string;
  /** Games finished (completed, not dropped) that month. */
  finished: number;
  /** Hours logged that month. */
  hours: number;
}

export interface GroupStat<K> {
  key: K;
  count: number;
  /** Average rating of the rated games in the group, or null when none is rated. */
  avgRating: number | null;
}

export interface Stats {
  /** The last `monthsBack` months, oldest first. */
  months: MonthBucket[];
  finishedTotal: number;
  droppedTotal: number;
  hoursLoggedTotal: number;
  ratedCount: number;
  avgRating: number | null;
  byType: GroupStat<GameType>[];
  byGenre: GroupStat<Genre>[];
}

export function computeStats(games: readonly Game[], sessions: readonly PlaySession[], now: Date = new Date(), monthsBack = 12): Stats {
  const done = completedGames(games);
  const finished = done.filter((g) => g.status === "completed");

  const months: MonthBucket[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({ month: monthKey(d), finished: 0, hours: 0 });
  }
  const index = new Map(months.map((bucket, i) => [bucket.month, i]));
  for (const game of finished) {
    const i = game.completedAt ? index.get(game.completedAt.slice(0, 7)) : undefined;
    if (i !== undefined) months[i].finished += 1;
  }
  for (const session of sessions) {
    const i = index.get(session.playedOn.slice(0, 7));
    if (i !== undefined) months[i].hours += session.hours;
  }

  const rated = finished.filter((g) => g.rating !== null);
  return {
    months,
    finishedTotal: finished.length,
    droppedTotal: done.length - finished.length,
    hoursLoggedTotal: sessions.reduce((sum, s) => sum + s.hours, 0),
    ratedCount: rated.length,
    avgRating: average(rated.map((g) => g.rating as number)),
    byType: groupBy(finished, (g) => g.type),
    byGenre: groupBy(
      finished.filter((g) => g.genre !== null),
      (g) => g.genre as Genre,
    ),
  };
}

function groupBy<K>(games: readonly Game[], key: (game: Game) => K): GroupStat<K>[] {
  const groups = new Map<K, Game[]>();
  for (const game of games) {
    const k = key(game);
    groups.set(k, [...(groups.get(k) ?? []), game]);
  }
  return Array.from(groups, ([k, members]) => ({
    key: k,
    count: members.length,
    avgRating: average(members.filter((g) => g.rating !== null).map((g) => g.rating as number)),
  })).sort((a, b) => b.count - a.count || String(a.key).localeCompare(String(b.key)));
}

function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, v) => sum + v, 0) / values.length) * 10) / 10;
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
