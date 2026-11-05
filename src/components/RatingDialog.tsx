import { useState, type FormEvent } from "react";
import type { Game } from "../domain/types";
import { t } from "../i18n/en";
import { Modal } from "./Modal";
import { RatingPicker } from "./RatingPicker";

interface Props {
  game: Game;
  onSubmit(rating: number | null, review: string | null): Promise<boolean>;
  onClose(): void;
}

/** Quick rating and review for a completed game. */
export function RatingDialog({ game, onSubmit, onClose }: Props) {
  const [rating, setRating] = useState<number | null>(game.rating);
  const [review, setReview] = useState(game.review ?? "");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    const ok = await onSubmit(rating, review.trim() === "" ? null : review.trim());
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal title={`${t.rating.dialogTitle}: ${game.title}`} onClose={onClose}>
      <form className="form" onSubmit={(event) => void submit(event)} noValidate>
        <div className="field">
          <span className="field-label">{t.rating.label}</span>
          <RatingPicker value={rating} onChange={setRating} />
        </div>
        <label className="field">
          <span className="field-label">{t.rating.review}</span>
          <textarea rows={3} value={review} onChange={(e) => setReview(e.target.value)} autoFocus />
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
