import { useEffect, useMemo, useState } from "react";
import { Banner } from "./components/Banner";
import { CompletedGameDialog } from "./components/CompletedGameDialog";
import { CompletedTable } from "./components/CompletedTable";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { EmptyState } from "./components/EmptyState";
import { FilterBar } from "./components/FilterBar";
import { FinishDialog } from "./components/FinishDialog";
import { GameDetailsDialog } from "./components/GameDetailsDialog";
import { GameDialog } from "./components/GameDialog";
import { Icon } from "./components/Icon";
import { NowPlaying } from "./components/NowPlaying";
import { PlanTable, type PlanRowView } from "./components/PlanTable";
import { PlatformTabs, tabId } from "./components/PlatformTabs";
import { RatingDialog } from "./components/RatingDialog";
import { SessionDialog } from "./components/SessionDialog";
import { SettingsPanel } from "./components/SettingsPanel";
import { SortControl } from "./components/SortControl";
import { StatsSection } from "./components/StatsSection";
import { TopBar } from "./components/TopBar";
import { TotalsBar } from "./components/TotalsBar";
import { UpdateBanner } from "./components/UpdateBanner";
import { WarningsBar } from "./components/WarningsBar";
import type { Backup } from "./domain/backup";
import { DEFAULT_SORT_DIRECTION, sortCompleted, type CompletedSortKey, type SortDirection } from "./domain/completed";
import { NO_FILTER, availablePlatforms, isFilterActive, matchesFilter, type GameFilter } from "./domain/filters";
import { computeSchedule, plannedGames } from "./domain/schedule";
import { todayStatus } from "./domain/today";
import { planWarnings } from "./domain/warnings";
import { PLATFORMS, SCHEDULED_PLATFORM, type Game, type Platform } from "./domain/types";
import { platformLabels, t } from "./i18n/en";
import { setStoreMessages, useStore } from "./state/store";
import { applyTheme } from "./state/theme";
import { useUpdates } from "./state/updates";
import "./styles/app.css";

setStoreMessages({
  exported: t.backup.exported,
  imported: t.backup.imported,
  invalidBackup: (path, reason) =>
    t.backup.invalid.replace("{path}", path).replace("{reason}", t.backup.reasons[reason] ?? reason),
  autoBackupFailed: (detail) => t.backup.autoFailed.replace("{detail}", detail),
  deleted: (title) => t.undoNotice.deleted.replace("{title}", title),
  dropped: (title) => t.undoNotice.dropped.replace("{title}", title),
  restored: (title) => t.undoNotice.restored.replace("{title}", title),
});

export default function App() {
  const status = useStore((s) => s.status);
  const error = useStore((s) => s.error);
  const load = useStore((s) => s.load);
  const theme = useStore((s) => s.settings.theme);
  const exportBackup = useStore((s) => s.exportBackup);
  const pickBackup = useStore((s) => s.pickBackup);
  const applyBackup = useStore((s) => s.applyBackup);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [platform, setPlatform] = useState<Platform>(SCHEDULED_PLATFORM);
  const [detailsId, setDetailsId] = useState<number | null>(null);
  const [pendingImport, setPendingImport] = useState<{ name: string; backup: Backup } | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  // Look for a newer release once per start; nothing shows unless there is one.
  useEffect(() => {
    void useUpdates.getState().check(true);
  }, []);

  useEffect(() => applyTheme(theme), [theme]);

  // The panel opens above the plan; bring it on screen, and hand focus back to its button when it closes.
  useEffect(() => {
    if (settingsOpen) document.getElementById("settings-panel")?.scrollIntoView({ block: "start" });
  }, [settingsOpen]);

  function closeSettings() {
    setSettingsOpen(false);
    document.querySelector<HTMLElement>('[aria-controls="settings-panel"]')?.focus();
  }

  async function startImport() {
    const picked = await pickBackup();
    if (picked) setPendingImport(picked);
  }

  if (status === "loading") {
    return (
      <div className="app">
        <header className="topbar">
          <div className="topbar-brand">
            <h1>{t.appTitle}</h1>
          </div>
        </header>
        <main className="screen muted" aria-busy="true">
          {t.loading}
        </main>
      </div>
    );
  }
  if (status === "error") {
    return (
      <main className="screen">
        <h1>{t.loadError}</h1>
        <p className="error">{error}</p>
      </main>
    );
  }

  return (
    <div className="app">
      <TopBar
        settingsOpen={settingsOpen}
        onToggleSettings={() => setSettingsOpen((open) => !open)}
        onExport={() => void exportBackup()}
        onImport={() => void startImport()}
      />
      <main>
        <UpdateBanner />
        <Banner />
        {settingsOpen && <SettingsPanel onClose={closeSettings} />}
        <PlanSection platform={platform} onPlatformChange={setPlatform} onOpen={(game) => setDetailsId(game.id)} />
        <CompletedSection defaultPlatform={platform} onOpen={(game) => setDetailsId(game.id)} />
        <StatsSection />
      </main>
      {detailsId !== null && <GameDetailsDialog gameId={detailsId} onClose={() => setDetailsId(null)} />}
      {pendingImport && (
        <ConfirmDialog
          title={t.backup.confirmTitle}
          question={t.backup.confirmQuestion
            .replace("{planned}", String(pendingImport.backup.games.filter((g) => g.status !== "completed").length))
            .replace("{completed}", String(pendingImport.backup.games.filter((g) => g.status === "completed").length))
            .replace("{file}", pendingImport.name)}
          warning={t.backup.confirmWarning}
          confirmLabel={t.backup.confirm}
          onConfirm={() => applyBackup(pendingImport.backup)}
          onClose={() => setPendingImport(null)}
        />
      )}
    </div>
  );
}

type PlanDialog =
  | { kind: "add" }
  | { kind: "edit"; game: Game }
  | { kind: "delete"; game: Game }
  | { kind: "finish"; game: Game }
  | { kind: "drop"; game: Game }
  | { kind: "log"; game: Game }
  | null;

interface PlanSectionProps {
  platform: Platform;
  onPlatformChange(platform: Platform): void;
  onOpen(game: Game): void;
}

const PLAN_PANEL_ID = "plan-panel";

function PlanSection({ platform, onPlatformChange, onOpen }: PlanSectionProps) {
  const games = useStore((s) => s.games);
  const settings = useStore((s) => s.settings);
  const addGame = useStore((s) => s.addGame);
  const editGame = useStore((s) => s.editGame);
  const removeGame = useStore((s) => s.removeGame);
  const moveGame = useStore((s) => s.moveGame);
  const finishGame = useStore((s) => s.finishGame);
  const setGameStatus = useStore((s) => s.setGameStatus);
  const dropGame = useStore((s) => s.dropGame);
  const [dialog, setDialog] = useState<PlanDialog>(null);
  const [filter, setFilter] = useState<GameFilter>(NO_FILTER);
  const platforms = useMemo(() => availablePlatforms(games), [games]);

  // Recomputed on every change to games or settings: this is the "live" part.
  const schedule = useMemo(() => computeSchedule(games, settings), [games, settings]);
  const today = useMemo(() => todayStatus(schedule, Date.now()), [schedule]);
  const scheduled = platform === SCHEDULED_PLATFORM;

  const rows = useMemo<PlanRowView[]>(
    () =>
      scheduled
        ? schedule.rows.map((row) => ({ game: row.game, index: row.index, schedule: row }))
        : plannedGames(games, platform).map((game, i) => ({ game, index: i + 1, schedule: null })),
    [scheduled, schedule, games, platform],
  );
  const filtering = isFilterActive(filter);
  const visibleRows = useMemo(() => (filtering ? rows.filter((row) => matchesFilter(row.game, filter)) : rows), [rows, filter, filtering]);

  const warnings = useMemo(() => {
    const planned = rows.map((row) => row.game);
    const byGame = new Map<number, string>();
    const messages: string[] = [];
    for (const warning of planWarnings(planned)) {
      const game = planned.find((g) => g.id === warning.gameId);
      if (!game) continue;
      const message =
        warning.kind === "adjacent_long"
          ? t.warnings.adjacentLong.replace("{title}", game.title).replace("{previous}", warning.previousTitle)
          : t.warnings.seriesOrder.replace("{series}", warning.series).replace("{title}", game.title).replace("{after}", warning.afterTitle);
      messages.push(message);
      byGame.set(game.id, byGame.has(game.id) ? `${byGame.get(game.id)} ${message}` : message);
    }
    return { byGame, messages };
  }, [rows]);

  const planTitles = useMemo(
    () =>
      Object.fromEntries(PLATFORMS.map((p) => [p, plannedGames(games, p).map((g) => g.title)])) as Record<
        Platform,
        string[]
      >,
    [games],
  );
  const counts = useMemo(
    () => Object.fromEntries(PLATFORMS.map((p) => [p, plannedGames(games, p).length])) as Record<Platform, number>,
    [games],
  );
  const close = () => setDialog(null);
  const platformLabel = platformLabels[platform];

  const addButton = (
    <button type="button" className="button button-primary" onClick={() => setDialog({ kind: "add" })}>
      <Icon name="plus" /> {t.actions.add}
    </button>
  );
  const empty = filtering ? (
    <EmptyState
      title={t.emptyFiltered}
      hint={t.emptyFilteredHint}
      action={
        <button type="button" className="button" onClick={() => setFilter(NO_FILTER)}>
          {t.filters.clear}
        </button>
      }
    />
  ) : scheduled ? (
    <EmptyState title={t.emptyPlan} hint={t.emptyPlanHint} action={addButton} />
  ) : (
    <EmptyState
      title={t.emptyQueue.replace("{platform}", platformLabel)}
      hint={t.emptyQueueHint.replace("{platform}", platformLabel)}
      action={addButton}
    />
  );

  return (
    <section className="section" aria-labelledby="plan-heading">
      <div className="section-head">
        <div className="section-title">
          <h2 id="plan-heading">{t.plan}</h2>
          <PlatformTabs active={platform} counts={counts} onChange={onPlatformChange} panelId={PLAN_PANEL_ID} />
          {addButton}
        </div>
        {scheduled ? <TotalsBar totals={schedule.totals} /> : <p className="section-hint">{t.queueHint}</p>}
      </div>
      <div id={PLAN_PANEL_ID} role="tabpanel" aria-labelledby={tabId(platform)}>
        <NowPlaying
          rows={rows}
          today={scheduled ? today : null}
          onOpen={onOpen}
          onFinish={(game) => setDialog({ kind: "finish", game })}
          onLog={(game) => setDialog({ kind: "log", game })}
          onPause={(game) => void setGameStatus(game.id, "paused")}
          onStart={(game) => void setGameStatus(game.id, "in_progress")}
        />
        <WarningsBar messages={warnings.messages} />
        {rows.length > 0 && (
          <FilterBar filter={filter} platforms={platforms} shown={visibleRows.length} total={rows.length} onChange={setFilter} />
        )}
        <PlanTable
          rows={visibleRows}
          showSchedule={scheduled}
          todayGameId={scheduled ? (today.expected?.game.id ?? null) : null}
          warnings={warnings.byGame}
          canReorder={!filtering}
          empty={empty}
          onEdit={(game) => setDialog({ kind: "edit", game })}
          onDelete={(game) => setDialog({ kind: "delete", game })}
          onFinish={(game) => setDialog({ kind: "finish", game })}
          onDrop={(game) => setDialog({ kind: "drop", game })}
          onLog={(game) => setDialog({ kind: "log", game })}
          onOpen={onOpen}
          onStatus={(game, status) => void setGameStatus(game.id, status)}
          onMove={(activeId, overId) => void moveGame(activeId, overId)}
        />
      </div>

      {dialog?.kind === "add" && (
        <GameDialog
          mode="add"
          defaultPlatform={platform}
          planTitles={planTitles}
          onSubmit={(values, index) => addGame(values, index)}
          onClose={close}
        />
      )}
      {dialog?.kind === "edit" && (
        <GameDialog
          mode="edit"
          game={dialog.game}
          defaultPlatform={platform}
          planTitles={planTitles}
          currentIndex={rows.findIndex((row) => row.game.id === dialog.game.id)}
          onSubmit={(values, index) => editGame(dialog.game.id, values, index)}
          onClose={close}
        />
      )}
      {dialog?.kind === "delete" && (
        <ConfirmDialog
          title={t.deleteDialog.title}
          question={t.deleteDialog.question.replace("{title}", dialog.game.title)}
          warning={t.deleteDialog.warning}
          confirmLabel={t.actions.delete}
          onConfirm={() => removeGame(dialog.game.id)}
          onClose={close}
        />
      )}
      {dialog?.kind === "log" && <SessionDialog game={dialog.game} onClose={close} />}
      {dialog?.kind === "drop" && (
        <ConfirmDialog
          title={t.dropDialog.title}
          question={t.dropDialog.question.replace("{title}", dialog.game.title)}
          warning={t.dropDialog.warning}
          confirmLabel={t.actions.drop}
          onConfirm={() => dropGame(dialog.game.id)}
          onClose={close}
        />
      )}
      {dialog?.kind === "finish" && (
        <FinishDialog
          game={dialog.game}
          nextTitle={rows.find((row) => row.game.id !== dialog.game.id)?.game.title ?? null}
          onSubmit={(input) => finishGame(dialog.game.id, input)}
          onClose={close}
        />
      )}
    </section>
  );
}

type CompletedDialog =
  | { kind: "add" }
  | { kind: "edit"; game: Game }
  | { kind: "rate"; game: Game }
  | { kind: "delete"; game: Game }
  | null;

function CompletedSection({ defaultPlatform, onOpen }: { defaultPlatform: Platform; onOpen(game: Game): void }) {
  const games = useStore((s) => s.games);
  const addCompletedGame = useStore((s) => s.addCompletedGame);
  const editGame = useStore((s) => s.editGame);
  const rateGame = useStore((s) => s.rateGame);
  const removeGame = useStore((s) => s.removeGame);
  const moveCompleted = useStore((s) => s.moveCompleted);
  const [sortKey, setSortKey] = useState<CompletedSortKey>("order");
  const [direction, setDirection] = useState<SortDirection>(DEFAULT_SORT_DIRECTION.order);
  const [filter, setFilter] = useState<Platform | "all">("all");
  const [modeFilter, setModeFilter] = useState<GameFilter>(NO_FILTER);
  const [dialog, setDialog] = useState<CompletedDialog>(null);
  const platforms = useMemo(() => availablePlatforms(games), [games]);

  const allCompleted = useMemo(() => sortCompleted(games, sortKey, direction), [games, sortKey, direction]);
  const completed = useMemo(
    () => allCompleted.filter((game) => (filter === "all" || game.platform === filter) && matchesFilter(game, modeFilter)),
    [allCompleted, filter, modeFilter],
  );
  const canReorder = sortKey === "order" && filter === "all" && !isFilterActive(modeFilter);
  const close = () => setDialog(null);

  const addButton = (
    <button type="button" className="button" onClick={() => setDialog({ kind: "add" })}>
      <Icon name="plus" /> {t.actions.addCompleted}
    </button>
  );
  const empty =
    allCompleted.length === 0 ? (
      <EmptyState title={t.emptyCompleted} hint={t.emptyCompletedHint} action={addButton} />
    ) : (
      <EmptyState
        title={t.emptyFiltered}
        hint={t.emptyFilteredHint}
        action={
          <button
            type="button"
            className="button"
            onClick={() => {
              setFilter("all");
              setModeFilter(NO_FILTER);
            }}
          >
            {t.filters.clear}
          </button>
        }
      />
    );

  return (
    <section className="section" aria-labelledby="completed-heading">
      <div className="section-head">
        <div className="section-title">
          <h2 id="completed-heading">
            {t.completed} <span className="count">{completed.length}</span>
          </h2>
          {addButton}
        </div>
        {allCompleted.length > 0 && (
          <div className="section-tools">
            <select value={filter} onChange={(e) => setFilter(e.target.value as Platform | "all")} aria-label={t.columns.platform}>
              <option value="all">{t.allPlatforms}</option>
              {PLATFORMS.map((p) => (
                <option key={p} value={p}>
                  {platformLabels[p]}
                </option>
              ))}
            </select>
            <SortControl
              sortKey={sortKey}
              direction={direction}
              onChange={(key, dir) => {
                setSortKey(key);
                setDirection(dir);
              }}
            />
          </div>
        )}
      </div>
      {allCompleted.length > 0 && (
        <FilterBar filter={modeFilter} platforms={platforms} shown={completed.length} total={allCompleted.length} onChange={setModeFilter} />
      )}
      <CompletedTable
        games={completed}
        canReorder={canReorder}
        empty={empty}
        onRate={(game) => setDialog({ kind: "rate", game })}
        onEdit={(game) => setDialog({ kind: "edit", game })}
        onDelete={(game) => setDialog({ kind: "delete", game })}
        onOpen={onOpen}
        onMove={(activeId, overId) => void moveCompleted(activeId, overId)}
      />

      {dialog?.kind === "add" && (
        <CompletedGameDialog mode="add" defaultPlatform={defaultPlatform} onSubmit={addCompletedGame} onClose={close} />
      )}
      {dialog?.kind === "edit" && (
        <CompletedGameDialog
          mode="edit"
          game={dialog.game}
          defaultPlatform={defaultPlatform}
          onSubmit={(values) => editGame(dialog.game.id, values)}
          onClose={close}
        />
      )}
      {dialog?.kind === "rate" && (
        <RatingDialog game={dialog.game} onSubmit={(rating, review) => rateGame(dialog.game.id, rating, review)} onClose={close} />
      )}
      {dialog?.kind === "delete" && (
        <ConfirmDialog
          title={t.deleteDialog.title}
          question={t.deleteDialog.question.replace("{title}", dialog.game.title)}
          confirmLabel={t.actions.delete}
          onConfirm={() => removeGame(dialog.game.id)}
          onClose={close}
        />
      )}
    </section>
  );
}
