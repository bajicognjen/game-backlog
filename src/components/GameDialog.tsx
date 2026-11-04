import { useState, type FormEvent } from "react";
import type { GameInput } from "../db";
import { GAME_TYPES, PLAN_PLATFORMS, SCHEDULED_PLATFORM, type Game, type GameType, type Platform } from "../domain/types";
import { platformLabels, t, typeLabels } from "../i18n/sr";
import { Modal } from "./Modal";

interface Props {
  mode: "add" | "edit";
  /** The game being edited (edit mode only). */
  game?: Game;
  /** Platform preselected when adding (the open tab). */
  defaultPlatform: Platform;
  /** Titles of each platform's planned games in plan order, for the position hint. */
  planTitles: Record<Platform, readonly string[]>;
  /** 0-based index of `game` in its platform's plan (edit mode only). */
  currentIndex?: number;
  /** Resolves true when saved; the dialog then closes itself. */
  onSubmit(values: GameInput, index: number): Promise<boolean>;
  onClose(): void;
}

interface Errors {
  title?: string;
  hours?: string;
  position?: string;
}

export function GameDialog({ mode, game, defaultPlatform, planTitles, currentIndex, onSubmit, onClose }: Props) {
  const [title, setTitle] = useState(game?.title ?? "");
  const [type, setType] = useState<GameType>(game?.type ?? "linear");
  const [platform, setPlatform] = useState<Platform>(game?.platform ?? defaultPlatform);
  const [hours, setHours] = useState(game && game.casualHours > 0 ? String(game.casualHours) : "");
  const [note, setNote] = useState(game?.note ?? "");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  // The position picks a slot among the other planned games of the chosen platform.
  const samePlatform = mode === "edit" && game?.platform === platform && currentIndex !== undefined;
  const others = samePlatform ? planTitles[platform].filter((_, i) => i !== currentIndex) : planTitles[platform];
  const maxPosition = others.length + 1;
  const [position, setPosition] = useState(String(samePlatform ? currentIndex + 1 : maxPosition));

  const positionNumber = Number(position);
  const positionValid = Number.isInteger(positionNumber) && positionNumber >= 1 && positionNumber <= maxPosition;
  const positionHint = !positionValid
    ? ""
    : positionNumber === maxPosition
      ? t.gameDialog.atEnd
      : `${t.gameDialog.before} ${others[positionNumber - 1]}`;
  const scheduled = platform === SCHEDULED_PLATFORM;

  function changePlatform(next: Platform) {
    setPlatform(next);
    const nextOthers = mode === "edit" && game?.platform === next && currentIndex !== undefined
      ? planTitles[next].filter((_, i) => i !== currentIndex)
      : planTitles[next];
    setPosition(String(mode === "edit" && game?.platform === next && currentIndex !== undefined ? currentIndex + 1 : nextOthers.length + 1));
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const hoursNumber = hours.trim() === "" ? 0 : Number(hours.replace(",", "."));
    const next: Errors = {};
    if (title.trim() === "") next.title = t.gameDialog.invalidTitle;
    if ((scheduled && hours.trim() === "") || !Number.isFinite(hoursNumber) || hoursNumber < 0) {
      next.hours = t.gameDialog.invalidHours;
    }
    if (!positionValid) next.position = t.gameDialog.invalidPosition.replace("{max}", String(maxPosition));
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    const ok = await onSubmit(
      { title: title.trim(), type, platform, casualHours: hoursNumber, note: note.trim() === "" ? null : note.trim() },
      positionNumber - 1,
    );
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal title={mode === "add" ? t.gameDialog.addTitle : t.gameDialog.editTitle} onClose={onClose}>
      <form className="form" onSubmit={(event) => void submit(event)} noValidate>
        <label className="field">
          <span className="field-label">{t.gameDialog.title}</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus aria-invalid={!!errors.title} />
          {errors.title && <span className="field-error">{errors.title}</span>}
        </label>

        <div className="form-row form-row-4">
          <label className="field">
            <span className="field-label">{t.gameDialog.platform}</span>
            <select value={platform} onChange={(e) => changePlatform(e.target.value as Platform)}>
              {PLAN_PLATFORMS.map((value) => (
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
            <span className="field-label">{scheduled ? t.gameDialog.hours : t.completedDialog.hours}</span>
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
            <span className="field-label">{t.gameDialog.position}</span>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={maxPosition}
              step={1}
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              aria-invalid={!!errors.position}
            />
            {errors.position ? (
              <span className="field-error">{errors.position}</span>
            ) : (
              <span className="field-hint">{positionHint}</span>
            )}
          </label>
        </div>

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
