import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { formatDate, isValidIsoDate } from "../domain/dates";
import { formatHours } from "../domain/format";
import { releaseYear, thumbnailUrl } from "../domain/provider";
import { planHours } from "../domain/schedule";
import { progressOf } from "../domain/sessions";
import type { TodayStatus } from "../domain/today";
import type { Game, Settings } from "../domain/types";
import { t } from "../i18n/en";
import { GenreChip } from "./GenreChip";
import { Icon } from "./Icon";
import type { PlanRowView } from "./PlanTable";
import { StatusBadge } from "./StatusBadge";
import { TypeChip } from "./TypeChip";

/** The two numbers every date in the PC plan follows from. */
export type PlanInputs = Pick<Settings, "startDate" | "hoursPerWeek">;

interface Props {
  /** The active platform's plan, in order. */
  rows: PlanRowView[];
  /** Where today falls in the PC plan; null on a queue without dates. */
  today: TodayStatus | null;
  /** The plan's start date and weekly hours; null on a queue without dates. */
  plan: PlanInputs | null;
  onPlanChange(patch: Partial<PlanInputs>): void;
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
 * short entrance, so the plan visibly moves on. On the PC plan the card also
 * carries the two inputs the dates follow from, editable in place.
 */
export function NowPlaying({ rows, today, plan, onPlanChange, onOpen, onFinish, onLog, onPause, onStart }: Props) {
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
  const anchor = plan && <PlanAnchor plan={plan} currentIsFirst={currentIndex === 0} onChange={onPlanChange} />;

  if (!current) {
    return (
      <section className={`now now-idle ${swapClass}`} aria-label={t.now.idle}>
        <div className="now-body">
          <h3 className="now-title">{t.now.idle}</h3>
          <p className="now-status">
            {next && (
              <span>
                {t.now.upNext}:{" "}
                <button type="button" className="link-button" onClick={() => onOpen(next.game)}>
                  {next.game.title}
                </button>
                {next.game.casualHours > 0 && <span className="muted"> · {formatHours(next.game.casualHours)} h</span>}
              </span>
            )}
            {anchor}
          </p>
          {plan && <p className="now-note">{t.now.explain}</p>}
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
          {anchor}
        </p>
        {plan && <p className="now-note">{t.now.explain}</p>}
      </div>
    </section>
  );
}

function driftOf(days: number): { text: string; tone: "ok" | "warn" } {
  if (days === 0) return { text: t.today.onTrack, tone: "ok" };
  if (days > 0) return { text: t.today.ahead.replace("{days}", String(days)), tone: "ok" };
  return { text: t.today.behind.replace("{days}", String(-days)), tone: "warn" };
}

/**
 * "started 02.11.2026 · 13 h/week": the plan's start date and weekly hours,
 * each a quiet control that turns into the matching field in place. The
 * label reads "plan starts" when the current game is not first, since the
 * date anchors the plan, not the game.
 */
function PlanAnchor({ plan, currentIsFirst, onChange }: { plan: PlanInputs; currentIsFirst: boolean; onChange(patch: Partial<PlanInputs>): void }) {
  const dateLabel = (currentIsFirst ? t.now.started : t.now.planStarts).replace("{date}", formatDate(plan.startDate));
  return (
    <span className="now-anchor">
      <InlineValue
        kind="date"
        text={dateLabel}
        value={plan.startDate}
        label={t.now.changeStart}
        validate={(value) => (isValidIsoDate(value) ? null : t.settings.invalidDate)}
        onCommit={(value) => value !== plan.startDate && onChange({ startDate: value })}
      />
      <span className="muted" aria-hidden="true">
        ·
      </span>
      <InlineValue
        kind="hours"
        text={t.now.hoursPerWeek.replace("{hours}", formatHours(plan.hoursPerWeek))}
        value={String(plan.hoursPerWeek)}
        label={t.now.changeHours}
        validate={(value) => {
          const n = Number(value.replace(",", "."));
          return value.trim() !== "" && Number.isFinite(n) && n > 0 ? null : t.settings.invalidHours;
        }}
        onCommit={(value) => {
          const n = Number(value.replace(",", "."));
          if (n !== plan.hoursPerWeek) onChange({ hoursPerWeek: n });
        }}
      />
    </span>
  );
}

interface InlineValueProps {
  kind: "date" | "hours";
  /** The value as read, e.g. "started 02.11.2026". */
  text: string;
  /** The raw value the field edits. */
  value: string;
  /** Accessible name of the control. */
  label: string;
  /** Null when `draft` may be saved, else the message to show. */
  validate(draft: string): string | null;
  onCommit(draft: string): void;
}

/** A value shown as text that becomes a field on click; Enter or leaving saves, Escape cancels. */
function InlineValue({ kind, text, value, label, validate, onCommit }: InlineValueProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const returnFocus = useRef(false);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
    else if (returnFocus.current) {
      returnFocus.current = false;
      buttonRef.current?.focus();
    }
  }, [editing]);

  function open() {
    setDraft(value);
    setError(null);
    setEditing(true);
  }

  function close(save: boolean) {
    if (save) {
      const problem = validate(draft);
      if (problem) {
        setError(problem);
        return;
      }
      onCommit(draft);
    }
    returnFocus.current = true;
    setEditing(false);
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      close(true);
    } else if (event.key === "Escape") {
      event.preventDefault();
      close(false);
    }
  }

  if (!editing) {
    return (
      <button ref={buttonRef} type="button" className="link-button inline-edit" aria-label={label} title={label} onClick={open}>
        {text}
        <Icon name="pencil" size={12} className="inline-edit-icon" />
      </button>
    );
  }

  return (
    <span className="inline-edit-field">
      <input
        ref={inputRef}
        type={kind === "date" ? "date" : "number"}
        className="inline-edit-input"
        aria-label={label}
        aria-invalid={error !== null}
        value={draft}
        min={kind === "hours" ? 0.5 : undefined}
        step={kind === "hours" ? 0.5 : undefined}
        inputMode={kind === "hours" ? "decimal" : undefined}
        onChange={(event) => {
          setDraft(event.target.value);
          setError(null);
        }}
        onBlur={() => close(true)}
        onKeyDown={onKeyDown}
      />
      {error && (
        <span className="field-error inline-edit-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
