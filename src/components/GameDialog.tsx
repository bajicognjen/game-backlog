import { useMemo, useState, type FormEvent } from "react";
import type { GameInput } from "../db";
import {
  GAME_TYPES,
  GENRES,
  PLAN_PLATFORMS,
  SCHEDULED_PLATFORM,
  TOGETHER,
  planOf,
  platformOfPlan,
  type Game,
  type GameType,
  type Genre,
  type PlanId,
  type Platform,
} from "../domain/types";
import { NO_METADATA } from "../domain/seed";
import { seriesNames } from "../domain/warnings";
import { useStore } from "../state/store";
import { genreLabels, platformLabels, sourceLabels, t, typeLabels } from "../i18n/en";
import { metadataOf, toMetadata, type Metadata } from "../domain/provider";
import { Modal } from "./Modal";
import { ProviderLinked } from "./ProviderLinked";
import { GameSearch, type SearchPick } from "./GameSearch";

interface Props {
  mode: "add" | "edit";
  /** The game being edited (edit mode only). */
  game?: Game;
  /** The open tab when adding: its platform is preselected, and the Together tab ticks "Played with others". */
  defaultPlan: PlanId;
  /** Titles of each plan's games in plan order, for the position hint. */
  planTitles: Record<PlanId, readonly string[]>;
  /** 0-based index of `game` in its plan (edit mode only). */
  currentIndex?: number;
  /** Resolves true when saved; the dialog then closes itself. */
  onSubmit(values: GameInput, index: number): Promise<boolean>;
  onClose(): void;
  /** Leave for the IGDB credentials in Settings. */
  onSetupIgdb?(): void;
  /** Add mode only: a title to start from (a Steam game), searched on IGDB right away and kept if nothing is picked. */
  initialQuery?: string;
}

interface Errors {
  title?: string;
  hours?: string;
  position?: string;
}

export function GameDialog({ mode, game, defaultPlan, planTitles, currentIndex, onSubmit, onClose, onSetupIgdb, initialQuery }: Props) {
  const [title, setTitle] = useState(game?.title ?? initialQuery ?? "");
  const [type, setType] = useState<GameType>(game?.type ?? "linear");
  const [genre, setGenre] = useState<Genre | "">(game?.genre ?? "");
  const [platform, setPlatform] = useState<Platform>(game?.platform ?? platformOfPlan(defaultPlan));
  const [together, setTogether] = useState(game?.together ?? defaultPlan === TOGETHER);
  const [hours, setHours] = useState(game && game.casualHours > 0 ? String(game.casualHours) : "");
  const [note, setNote] = useState(game?.note ?? "");
  const [series, setSeries] = useState(game?.series ?? "");
  const [seriesOrder, setSeriesOrder] = useState(game?.seriesOrder !== null && game?.seriesOrder !== undefined ? String(game.seriesOrder) : "");
  const allGames = useStore((s) => s.games);
  /** Without IGDB the search finds only games already here; a new game starts at its title. */
  const igdbReady = useStore((s) => s.settings.igdbClientId !== "" && s.settings.igdbClientSecret !== "");
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
      // Picking a library game from an add form creates a duplicate; say so.
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

  // The position picks a slot among the other games of the chosen plan: the platform's, or Together.
  const plan = planOf({ platform, together });
  /** The game stays in the plan it is in: its own slot does not count as another game. */
  const inOwnPlan = (target: PlanId) => mode === "edit" && game !== undefined && planOf(game) === target && currentIndex !== undefined;
  const othersIn = (target: PlanId) => (inOwnPlan(target) ? planTitles[target].filter((_, i) => i !== currentIndex) : planTitles[target]);
  const others = othersIn(plan);
  const maxPosition = others.length + 1;
  const [position, setPosition] = useState(String(inOwnPlan(plan) && currentIndex !== undefined ? currentIndex + 1 : maxPosition));

  const positionNumber = Number(position);
  const positionValid = Number.isInteger(positionNumber) && positionNumber >= 1 && positionNumber <= maxPosition;
  const positionHint = !positionValid
    ? ""
    : positionNumber === maxPosition
      ? t.gameDialog.atEnd
      : `${t.gameDialog.before} ${others[positionNumber - 1]}`;
  const scheduled = plan === SCHEDULED_PLATFORM;

  /** A different plan has its own order: start from the game's own slot there, or the end. */
  function changePlan(next: PlanId) {
    setPosition(String(inOwnPlan(next) && currentIndex !== undefined ? currentIndex + 1 : othersIn(next).length + 1));
  }

  function changePlatform(next: Platform) {
    setPlatform(next);
    changePlan(planOf({ platform: next, together }));
  }

  function changeTogether(next: boolean) {
    setTogether(next);
    changePlan(planOf({ platform, together: next }));
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
        together,
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
    <Modal title={mode === "add" ? t.gameDialog.addTitle : t.gameDialog.editTitle} onClose={onClose} size="lg">
      <form className="form" onSubmit={(event) => void submit(event)} noValidate>
        <GameSearch onPick={applyPick} autoFocus={mode === "add" && igdbReady} onSetupIgdb={onSetupIgdb} initialQuery={mode === "add" ? initialQuery : undefined} />
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
            data-autofocus={mode === "edit" || !igdbReady ? "true" : undefined}
          />
          {errors.title && <span className="field-error">{errors.title}</span>}
        </label>

        <div className="form-row">
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
            <input type="checkbox" checked={together} onChange={(e) => changeTogether(e.target.checked)} aria-describedby="together-hint" />
            <span>{t.gameDialog.together}</span>
          </label>
          <span className="field-hint" id="together-hint">
            {t.gameDialog.togetherHint}
          </span>
        </div>

        <div className="form-row form-row-2">
          <label className="field">
            <span className="field-label">{scheduled ? t.gameDialog.hours : t.gameDialog.hoursOptional}</span>
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
            <span className="field-hint">{t.gameDialog.seriesHint}</span>
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
