import { useState, type FormEvent } from "react";
import type { FinishInput } from "../db";
import { isValidIsoDate, todayIso } from "../domain/dates";
import { formatHours } from "../domain/format";
import { planHours } from "../domain/schedule";
import { SCHEDULED_PLATFORM, planOf, type Game } from "../domain/types";
import { t } from "../i18n/en";
import { DateField } from "./DateField";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { RatingPicker } from "./RatingPicker";
import { SteamFinishHint } from "./SteamFinishHint";

interface Props {
  game: Game;
  /** Title of the game that becomes current afterwards, if any. */
  nextTitle: string | null;
  onSubmit(input: FinishInput): Promise<boolean>;
  onClose(): void;
  /** The finish date to start from (Steam's, from the hints bar); today otherwise. */
  initialDate?: string;
}

export function FinishDialog({ game, nextTitle, onSubmit, onClose, initialDate }: Props) {
  const today = todayIso();
  const [completedAt, setCompletedAt] = useState(initialDate ?? today);
  // The next game starts where this one ended, as when the finish date is changed by hand.
  const [nextStartDate, setNextStartDate] = useState(initialDate ?? today);
  const [rating, setRating] = useState<number | null>(null);
  const [review, setReview] = useState("");
  // The PC plan continues with the next game by default; a queue or the Together list does not.
  const [startNext, setStartNext] = useState(planOf(game) === SCHEDULED_PLATFORM);
  /** Until the next-start date is edited by hand, it follows the finish date. */
  const [nextTouched, setNextTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function changeCompletedAt(value: string) {
    setCompletedAt(value);
    if (!nextTouched) setNextStartDate(value);
  }

  /** Only the PC plan has a start date to move; a Together game on PC leaves it alone. */
  const scheduled = planOf(game) === SCHEDULED_PLATFORM;
  const completedAtValid = isValidIsoDate(completedAt);
  const nextStartValid = !scheduled || isValidIsoDate(nextStartDate);
  const played =
    game.hoursPlayed <= 0
      ? null
      : game.casualHours > 0
        ? t.sessions.summary
            .replace("{played}", formatHours(game.hoursPlayed))
            .replace("{estimate}", formatHours(game.casualHours))
            .replace("{remaining}", formatHours(planHours(game)))
        : t.sessions.summaryNoEstimate.replace("{played}", formatHours(game.hoursPlayed));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    if (!completedAtValid || !nextStartValid) return;
    setBusy(true);
    const ok = await onSubmit({
      completedAt,
      nextStartDate: scheduled ? nextStartDate : null,
      startNext: nextTitle !== null && startNext,
      rating,
      review: review.trim() === "" ? null : review.trim(),
    });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal title={`${t.finishDialog.title}: ${game.title}`} onClose={onClose}>
      <form className="form" onSubmit={(event) => void submit(event)} noValidate>
        {played && <p className="modal-text muted">{played}</p>}
        <div className={scheduled ? "form-row form-row-2" : "form-row form-row-1"}>
          <div className="field">
            <span className="field-label" id="finish-date-label">
              {t.finishDialog.completedAt}
            </span>
            <DateField value={completedAt} onChange={changeCompletedAt} ariaLabel={t.finishDialog.completedAt} invalid={submitted && !completedAtValid} autoFocus />
            {submitted && !completedAtValid && <span className="field-error">{t.finishDialog.invalidDate}</span>}
          </div>
          {scheduled && (
            <div className="field">
              <span className="field-label">{t.finishDialog.nextStart}</span>
              <DateField
                value={nextStartDate}
                onChange={(value) => {
                  setNextTouched(true);
                  setNextStartDate(value);
                }}
                ariaLabel={t.finishDialog.nextStart}
                invalid={submitted && !nextStartValid}
              />
              {submitted && !nextStartValid ? (
                <span className="field-error">{t.finishDialog.invalidDate}</span>
              ) : (
                nextTitle === null && <span className="field-hint">{t.finishDialog.noNextGame}</span>
              )}
            </div>
          )}
          <SteamFinishHint game={game} value={completedAt} onUse={changeCompletedAt} />
        </div>

        {nextTitle !== null && (
          <label className="checkbox">
            <input type="checkbox" checked={startNext} onChange={(e) => setStartNext(e.target.checked)} />
            <span>{t.finishDialog.startNext.replace("{title}", nextTitle)}</span>
          </label>
        )}

        <div className="field">
          <span className="field-label">{t.rating.label}</span>
          <RatingPicker value={rating} onChange={setRating} />
          <span className="field-hint">{t.finishDialog.ratingHint}</span>
        </div>

        <label className="field">
          <span className="field-label">{t.rating.review}</span>
          <textarea rows={2} value={review} onChange={(e) => setReview(e.target.value)} />
        </label>

        <footer className="modal-actions">
          <button type="button" className="button" onClick={onClose} disabled={busy}>
            {t.cancel}
          </button>
          <button type="submit" className="button button-success" disabled={busy}>
            <Icon name="check" /> {t.finishDialog.confirm}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
