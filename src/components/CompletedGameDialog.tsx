import { useMemo, useState, type FormEvent } from "react";
import type { CompletedDetails, GameInput } from "../db";
import { isValidIsoDate } from "../domain/dates";
import { GAME_TYPES, GENRES, PLATFORMS, type Game, type GameType, type Genre, type Platform } from "../domain/types";
import { NO_METADATA } from "../domain/seed";
import { seriesNames } from "../domain/warnings";
import { useStore } from "../state/store";
import { genreLabels, platformLabels, sourceLabels, t, typeLabels } from "../i18n/en";
import { metadataOf, toMetadata, type Metadata } from "../domain/provider";
import { DateField } from "./DateField";
import { Modal } from "./Modal";
import { ProviderLinked } from "./ProviderLinked";
import { GameSearch, type SearchPick } from "./GameSearch";
import { RatingPicker } from "./RatingPicker";
import { SteamFinishHint } from "./SteamFinishHint";

interface Props {
  mode: "add" | "edit";
  game?: Game;
  defaultPlatform: Platform;
  /** Adding from the Together tab: the game was played with others. */
  defaultTogether?: boolean;
  onSubmit(values: GameInput & CompletedDetails): Promise<boolean>;
  onClose(): void;
  /** Leave for the IGDB credentials in Settings. */
  onSetupIgdb?(): void;
}

interface Errors {
  title?: string;
  hours?: string;
  completedAt?: string;
}

/** Add a game finished before the app existed, or edit a completed game. */
export function CompletedGameDialog({ mode, game, defaultPlatform, defaultTogether = false, onSubmit, onClose, onSetupIgdb }: Props) {
  const [title, setTitle] = useState(game?.title ?? "");
  const [type, setType] = useState<GameType>(game?.type ?? "linear");
  const [genre, setGenre] = useState<Genre | "">(game?.genre ?? "");
  const [platform, setPlatform] = useState<Platform>(game?.platform ?? defaultPlatform);
  const [together, setTogether] = useState(game?.together ?? defaultTogether);
  const [hours, setHours] = useState(game && game.casualHours > 0 ? String(game.casualHours) : "");
  const [note, setNote] = useState(game?.note ?? "");
  const [completedAt, setCompletedAt] = useState(game?.completedAt ?? "");
  const [rating, setRating] = useState<number | null>(game?.rating ?? null);
  const [review, setReview] = useState(game?.review ?? "");
  const [series, setSeries] = useState(game?.series ?? "");
  const [seriesOrder, setSeriesOrder] = useState(game?.seriesOrder !== null && game?.seriesOrder !== undefined ? String(game.seriesOrder) : "");
  const allGames = useStore((s) => s.games);
  const knownSeries = useMemo(() => seriesNames(allGames), [allGames]);
  const [meta, setMeta] = useState<Metadata>(game ? metadataOf(game) : NO_METADATA);
  const [pick, setPick] = useState<{ note: string; tone: "hint" | "warn" } | null>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  function applyPick(picked: SearchPick) {
    if (picked.kind === "library") {
      const g = picked.game;
      setTitle(g.title);
      setType(g.type);
      setGenre(g.genre ?? "");
      setHours(g.casualHours > 0 ? String(g.casualHours) : "");
      setNote(g.note ?? "");
      setMeta(metadataOf(g));
      setPick({ note: t.search.inLibraryNote, tone: mode === "add" ? "warn" : "hint" });
      return;
    }
    const m = picked.meta;
    setTitle(m.title);
    if (m.genre) setGenre(m.genre);
    if (m.typeHint) setType(m.typeHint);
    if (m.playtimeHours && hours.trim() === "") setHours(String(m.playtimeHours));
    if (m.seriesHint && series.trim() === "") setSeries(m.seriesHint);
    setMeta(toMetadata(m));
    setPick({ note: t.search.filled.replace("{source}", sourceLabels[m.source]), tone: "hint" });
  }

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
      genre: genre === "" ? null : genre,
      platform,
      together,
      casualHours: hoursNumber,
      series: series.trim() === "" ? null : series.trim(),
      seriesOrder: series.trim() !== "" && seriesOrder.trim() !== "" ? Math.trunc(Number(seriesOrder)) : null,
      note: note.trim() === "" ? null : note.trim(),
      completedAt: completedAt === "" ? null : completedAt,
      rating,
      review: review.trim() === "" ? null : review.trim(),
      ...meta,
    });
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal title={mode === "add" ? t.completedDialog.addTitle : t.completedDialog.editTitle} onClose={onClose} size="lg">
      <form className="form" onSubmit={(event) => void submit(event)} noValidate>
        <GameSearch onPick={applyPick} autoFocus={mode === "add"} onSetupIgdb={onSetupIgdb} />
        <ProviderLinked
          meta={meta}
          note={pick?.note ?? null}
          noteTone={pick?.tone}
          onUnlink={() => {
            setMeta(NO_METADATA);
            setPick(null);
          }}
        />

        <label className="field">
          <span className="field-label">{t.gameDialog.title}</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            aria-invalid={!!errors.title}
            data-autofocus={mode === "edit" ? "true" : undefined}
          />
          {errors.title && <span className="field-error">{errors.title}</span>}
        </label>

        <div className="form-row">
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
          <label className="field" title={t.columns.typeHint}>
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
        </div>

        <div className="field-check">
          <label className="checkbox">
            <input type="checkbox" checked={together} onChange={(e) => setTogether(e.target.checked)} aria-describedby="together-done-hint" />
            <span>{t.gameDialog.together}</span>
          </label>
          <span className="field-hint" id="together-done-hint">
            {t.completedDialog.togetherHint}
          </span>
        </div>

        <div className="form-row form-row-2">
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
          <div className="field">
            <span className="field-label">{t.completedDialog.completedAt}</span>
            <DateField value={completedAt} onChange={setCompletedAt} ariaLabel={t.completedDialog.completedAt} invalid={!!errors.completedAt} />
            {errors.completedAt && <span className="field-error">{errors.completedAt}</span>}
          </div>
        </div>
        {game && <SteamFinishHint game={game} value={completedAt} onUse={setCompletedAt} />}

        <div className="field">
          <span className="field-label">{t.rating.label}</span>
          <RatingPicker value={rating} onChange={setRating} />
        </div>

        <label className="field">
          <span className="field-label">{t.rating.review}</span>
          <textarea rows={2} value={review} onChange={(e) => setReview(e.target.value)} />
        </label>

        <div className="form-row form-row-series">
          <label className="field">
            <span className="field-label">{t.gameDialog.series}</span>
            <input type="text" list="series-names-done" value={series} onChange={(e) => setSeries(e.target.value)} />
            <datalist id="series-names-done">
              {knownSeries.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span className="field-label">{t.gameDialog.seriesOrder}</span>
            <input type="number" inputMode="numeric" min={1} step={1} value={seriesOrder} onChange={(e) => setSeriesOrder(e.target.value)} />
          </label>
        </div>

        <label className="field">
          <span className="field-label">{t.gameDialog.note}</span>
          <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>

        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose} disabled={busy}>
            {t.cancel}
          </button>
          <button type="submit" className="button button-primary" disabled={busy}>
            {t.save}
          </button>
        </div>
      </form>
    </Modal>
  );
}
