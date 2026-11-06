import { useEffect, useRef, useState } from "react";
import { formatDate } from "../domain/dates";
import { formatHours } from "../domain/format";
import { releaseYear, thumbnailUrl } from "../domain/provider";
import { planHours } from "../domain/schedule";
import { progressOf } from "../domain/sessions";
import type { TodayStatus } from "../domain/today";
import type { Game } from "../domain/types";
import { t } from "../i18n/en";
import { GenreChip } from "./GenreChip";
import { Icon } from "./Icon";
import type { PlanRowView } from "./PlanTable";
import { StatusBadge } from "./StatusBadge";
import { TypeChip } from "./TypeChip";

interface Props {
  /** The active platform's plan, in order. */
  rows: PlanRowView[];
  /** Where today falls in the PC plan; null on a queue without dates. */
  today: TodayStatus | null;
  onOpen(game: Game): void;
  onFinish(game: Game): void;
  onLog(game: Game): void;
  onPause(game: Game): void;
  onStart(game: Game): void;
}

/** How long the handover entrance runs; matches `now-enter` in the stylesheet. */
const SWAP_MS = 400;

/**
 * The game being played now: progress, whether the plan is on track, and
 * what comes next. Without a game in progress it offers the next one. When
 * the current game changes (a finish, a start) the card hands over with a
 * short entrance, so the plan visibly moves on.
 */
export function NowPlaying({ rows, today, onOpen, onFinish, onLog, onPause, onStart }: Props) {
  const currentIndex = rows.findIndex((row) => row.game.status === "in_progress");
  const current = currentIndex >= 0 ? rows[currentIndex] : null;
  const next = (current ? rows.slice(currentIndex + 1) : rows).find((row) => row.game.status !== "in_progress") ?? null;
  const currentId = current?.game.id ?? null;

  // Animate only a change after mount, never the first paint.
  const shownId = useRef(currentId);
  const [swapping, setSwapping] = useState(false);
  useEffect(() => {
    if (shownId.current === currentId) return;
    shownId.current = currentId;
    setSwapping(true);
    const timer = setTimeout(() => setSwapping(false), SWAP_MS);
    return () => clearTimeout(timer);
  }, [currentId]);

  if (rows.length === 0) return null;
  const swapClass = swapping ? "now-swap" : "";

  if (!current) {
    return (
      <section className={`now now-idle ${swapClass}`} aria-label={t.now.idle}>
        <div className="now-body">
          <h3 className="now-title">{t.now.idle}</h3>
          {next && (
            <p className="now-status">
              <span>
                {t.now.upNext}:{" "}
                <button type="button" className="link-button" onClick={() => onOpen(next.game)}>
                  {next.game.title}
                </button>
                {next.game.casualHours > 0 && <span className="muted"> · {formatHours(next.game.casualHours)} h</span>}
              </span>
            </p>
          )}
        </div>
        {next && (
          <div className="now-actions">
            <button type="button" className="button button-primary" onClick={() => onStart(next.game)}>
              <Icon name="play" /> {next.game.status === "paused" ? t.actions.resume : t.actions.start}
            </button>
          </div>
        )}
      </section>
    );
  }

  const { game, schedule } = current;
  const year = releaseYear(game.releaseDate);
  const progress = progressOf(game);
  const hoursText =
    game.casualHours <= 0
      ? game.hoursPlayed > 0
        ? t.now.playedNoEstimate.replace("{played}", formatHours(game.hoursPlayed))
        : t.now.noEstimate
      : game.hoursPlayed > 0
        ? t.now.played
            .replace("{played}", formatHours(game.hoursPlayed))
            .replace("{estimate}", formatHours(game.casualHours))
            .replace("{remaining}", formatHours(planHours(game)))
        : t.now.estimated.replace("{estimate}", formatHours(game.casualHours));
  const drift = today && today.driftDays !== null ? driftOf(today.driftDays) : null;
  const daysText =
    today && today.daysToCurrentEnd !== null
      ? today.daysToCurrentEnd >= 0
        ? t.today.endsIn.replace("{days}", String(today.daysToCurrentEnd))
        : t.today.overdue.replace("{days}", String(-today.daysToCurrentEnd))
      : null;

  return (
    <section className={`now ${swapClass}`} aria-labelledby="now-title">
      {game.coverUrl && <img className="now-cover" src={thumbnailUrl(game.coverUrl, 200)} alt="" width={96} height={128} />}
      <div className="now-body">
        <div className="now-head">
          <div className="now-heading">
            <h3 id="now-title" className="now-title">
              <button type="button" className="link-button" onClick={() => onOpen(game)} title={t.actions.details}>
                {game.title}
              </button>
              {year && <span className="muted year"> ({year})</span>}
            </h3>
            <p className="now-meta">
              <StatusBadge status="in_progress" />
              <TypeChip type={game.type} />
              <GenreChip genre={game.genre} />
              {schedule && currentIndex === 0 && <span>{t.now.started.replace("{date}", formatDate(schedule.startMs))}</span>}
            </p>
          </div>
          <div className="now-actions">
            <button type="button" className="button" onClick={() => onLog(game)}>
              <Icon name="clock" /> {t.actions.logHours}
            </button>
            <button type="button" className="button" onClick={() => onPause(game)}>
              <Icon name="pause" /> {t.actions.pause}
            </button>
            <button type="button" className="button button-success" onClick={() => onFinish(game)}>
              <Icon name="check" /> {t.actions.finish}
            </button>
          </div>
        </div>

        <div className="now-progress">
          <span className="progress" aria-hidden="true">
            <span className="progress-bar" style={{ width: `${Math.round((progress ?? 0) * 100)}%` }} />
          </span>
          <span className="now-hours">{hoursText}</span>
        </div>

        <p className="now-status">
          {drift && <span className={`now-drift now-drift-${drift.tone}`}>{drift.text}</span>}
          {schedule && daysText && (
            <span>
              {daysText} · {t.now.ends.replace("{date}", formatDate(schedule.endMs))}
            </span>
          )}
          {next ? (
            <span>
              {t.now.next}:{" "}
              <button type="button" className="link-button" onClick={() => onOpen(next.game)}>
                {next.game.title}
              </button>
              {next.schedule && (
                <span className="muted">
                  {" "}
                  · {formatHours(next.schedule.hours)} h · {t.now.from.replace("{date}", formatDate(next.schedule.startMs))}
                </span>
              )}
            </span>
          ) : (
            <span className="muted">{t.now.last}</span>
          )}
        </p>
      </div>
    </section>
  );
}

function driftOf(days: number): { text: string; tone: "ok" | "warn" } {
  if (days === 0) return { text: t.today.onTrack, tone: "ok" };
  if (days > 0) return { text: t.today.ahead.replace("{days}", String(days)), tone: "ok" };
  return { text: t.today.behind.replace("{days}", String(-days)), tone: "warn" };
}
