import { useState, type FormEvent } from "react";
import type { CompletedDetails, GameInput } from "../db";
import { isValidIsoDate } from "../domain/dates";
import { GAME_TYPES, PLATFORMS, type Game, type GameType, type Platform } from "../domain/types";
import { platformLabels, t, typeLabels } from "../i18n/sr";
import { Modal } from "./Modal";
import { RatingPicker } from "./RatingPicker";

interface Props {
  mode: "add" | "edit";
  game?: Game;
  defaultPlatform: Platform;
  onSubmit(values: GameInput & CompletedDetails): Promise<boolean>;
  onClose(): void;
}

interface Errors {
  title?: string;
  hours?: string;
  completedAt?: string;
}

/** Add a game finished before the app existed, or edit a completed game. */
export function CompletedGameDialog({ mode, game, defaultPlatform, onSubmit, onClose }: Props) {
  const [title, setTitle] = useState(game?.title ?? "");
  const [type, setType] = useState<GameType>(game?.type ?? "linear");
  const [platform, setPlatform] = useState<Platform>(game?.platform ?? defaultPlatform);
  const [hours, setHours] = useState(game && game.casualHours > 0 ? String(game.casualHours) : "");
  const [note, setNote] = useState(game?.note ?? "");
  const [completedAt, setCompletedAt] = useState(game?.completedAt ?? "");
  const [rating, setRating] = useState<number | null>(game?.rating ?? null);
  const [review, setReview] = useState(game?.review ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const hoursNumber = hours.trim() === "" ? 0 : Number(hours.replace(",", "."));
    const next: Errors = {};
    if (title.trim() === "") next.title = t.gameDialog.invalidTitle;
    if (!Number.isFinite(hoursNumber) || hoursNumber < 0) next.hours = t.gameDialog.invalidHours;
    if (completedAt !== "" && !isValidIsoDate(completedAt)) next.completedAt = t.finishDialog.invalidDate;
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    const ok = await onSubmit({
      title: title.trim(),
      type,
      platform,
      casualHours: hoursNumber,
      note: note.trim() === "" ? null : note.trim(),
      completedAt: completedAt === "" ? null : completedAt,
      rating,
      review: review.trim() === "" ? null : review.trim(),
    });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal title={mode === "add" ? t.completedDialog.addTitle : t.completedDialog.editTitle} onClose={onClose}>
      <form className="form" onSubmit={(event) => void submit(event)} noValidate>
        <label className="field">
          <span className="field-label">{t.gameDialog.title}</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus aria-invalid={!!errors.title} />
          {errors.title && <span className="field-error">{errors.title}</span>}
        </label>

        <div className="form-row form-row-4">
          <label className="field">
            <span className="field-label">{t.gameDialog.platform}</span>
            <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
              {PLATFORMS.map((value) => (
                <option key={value} value={value}>
                  {platformLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">{t.gameDialog.type}</span>
            <select value={type} onChange={(e) => setType(e.target.value as GameType)}>
              {GAME_TYPES.map((value) => (
                <option key={value} value={value}>
                  {typeLabels[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">{t.completedDialog.hours}</span>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.5}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              aria-invalid={!!errors.hours}
            />
            {errors.hours && <span className="field-error">{errors.hours}</span>}
          </label>
          <label className="field">
            <span className="field-label">{t.completedDialog.completedAt}</span>
            <input
              type="date"
              value={completedAt}
              onChange={(e) => setCompletedAt(e.target.value)}
              aria-invalid={!!errors.completedAt}
            />
            {errors.completedAt && <span className="field-error">{errors.completedAt}</span>}
          </label>
        </div>

        <div className="field">
          <span className="field-label">{t.rating.label}</span>
          <RatingPicker value={rating} onChange={setRating} />
        </div>

        <label className="field">
          <span className="field-label">{t.rating.review}</span>
          <textarea rows={2} value={review} onChange={(e) => setReview(e.target.value)} />
        </label>

        <label className="field">
          <span className="field-label">{t.gameDialog.note}</span>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <footer className="modal-actions">
          <button type="button" className="button" onClick={onClose} disabled={busy}>
            {t.cancel}
          </button>
          <button type="submit" className="button button-primary" disabled={busy}>
            {t.save}
          </button>
        </footer>
      </form>
    </Modal>
  );
}
