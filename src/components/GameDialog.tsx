import { useMemo, useState, type FormEvent } from "react";
import type { GameInput } from "../db";
import {
  GAME_TYPES,
  GENRES,
  PLAN_PLATFORMS,
  SCHEDULED_PLATFORM,
  type Game,
  type GameType,
  type Genre,
  type Platform,
} from "../domain/types";
import { NO_METADATA } from "../domain/seed";
import { seriesNames } from "../domain/warnings";
import { useStore } from "../state/store";
import { genreLabels, platformLabels, sourceLabels, t, typeLabels } from "../i18n/sr";
import { metadataOf, toMetadata, type Metadata } from "../domain/provider";
import { Modal } from "./Modal";
import { ProviderLinked } from "./ProviderLinked";
import { GameSearch, type SearchPick } from "./GameSearch";

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
  const [genre, setGenre] = useState<Genre | "">(game?.genre ?? "");
  const [platform, setPlatform] = useState<Platform>(game?.platform ?? defaultPlatform);
  const [hours, setHours] = useState(game && game.casualHours > 0 ? String(game.casualHours) : "");
  const [note, setNote] = useState(game?.note ?? "");
  const [series, setSeries] = useState(game?.series ?? "");
  const [seriesOrder, setSeriesOrder] = useState(game?.seriesOrder !== null && game?.seriesOrder !== undefined ? String(game.seriesOrder) : "");
  const allGames = useStore((s) => s.games);
  const knownSeries = useMemo(() => seriesNames(allGames), [allGames]);
  const [meta, setMeta] = useState<Metadata>(game ? metadataOf(game) : NO_METADATA);
  const [pickNote, setPickNote] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  function applyPick(pick: SearchPick) {
    if (pick.kind === "library") {
      const g = pick.game;
      setTitle(g.title);
      setType(g.type);
      setGenre(g.genre ?? "");
      setHours(g.casualHours > 0 ? String(g.casualHours) : "");
      setNote(g.note ?? "");
      setMeta(metadataOf(g));
      setPickNote(t.search.inLibraryNote);
      return;
    }
    const m = pick.meta;
    setTitle(m.title);
    if (m.genre) setGenre(m.genre);
    if (m.typeHint) setType(m.typeHint);
    if (m.playtimeHours && hours.trim() === "") setHours(String(m.playtimeHours));
    if (m.seriesHint && series.trim() === "") setSeries(m.seriesHint);
    setMeta(toMetadata(m));
    setPickNote(t.search.filled.replace("{source}", sourceLabels[m.source]));
  }

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
      {
        title: title.trim(),
        type,
        genre: genre === "" ? null : genre,
        platform,
        casualHours: hoursNumber,
        series: series.trim() === "" ? null : series.trim(),
        seriesOrder: series.trim() !== "" && seriesOrder.trim() !== "" ? Math.trunc(Number(seriesOrder)) : null,
        note: note.trim() === "" ? null : note.trim(),
        ...meta,
      },
      positionNumber - 1,
    );
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal title={mode === "add" ? t.gameDialog.addTitle : t.gameDialog.editTitle} onClose={onClose}>
      <form className="form" onSubmit={(event) => void submit(event)} noValidate>
        <GameSearch onPick={applyPick} />
        <ProviderLinked
          meta={meta}
          note={pickNote}
          onUnlink={() => {
            setMeta(NO_METADATA);
            setPickNote(null);
          }}
        />

        <label className="field">
          <span className="field-label">{t.gameDialog.title}</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} aria-invalid={!!errors.title} />
          {errors.title && <span className="field-error">{errors.title}</span>}
        </label>

        <div className="form-row form-row-5">
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
            <span className="field-label">{t.gameDialog.genre}</span>
            <select value={genre} onChange={(e) => setGenre(e.target.value as Genre | "")}>
              <option value="">{t.gameDialog.noGenre}</option>
              {GENRES.map((value) => (
                <option key={value} value={value}>
                  {genreLabels[value]}
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

        <div className="form-row form-row-series">
          <label className="field">
            <span className="field-label">{t.gameDialog.series}</span>
            <input type="text" list="series-names" value={series} onChange={(e) => setSeries(e.target.value)} />
            <datalist id="series-names">
              {knownSeries.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span className="field-label">{t.gameDialog.seriesOrder}</span>
            <input type="number" inputMode="numeric" min={1} step={1} value={seriesOrder} onChange={(e) => setSeriesOrder(e.target.value)} />
            <span className="field-hint">{t.gameDialog.seriesHint}</span>
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

