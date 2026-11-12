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
import { PlanTabs, tabId } from "./components/PlanTabs";
import { RatingDialog } from "./components/RatingDialog";
import { SessionDialog } from "./components/SessionDialog";
import { SettingsPanel } from "./components/SettingsPanel";
import { SortControl } from "./components/SortControl";
import { StatsSection } from "./components/StatsSection";
import { SteamHintsBar } from "./components/SteamHintsBar";
import { SteamLibraryDialog } from "./components/SteamLibraryDialog";
import { TopBar } from "./components/TopBar";
import { TotalsBar } from "./components/TotalsBar";
import { SyncBanner } from "./components/SyncBanner";
import type { SyncJoinRequest } from "./components/SyncSettings";
import { keyInJoinLink } from "./domain/sync";
import { UpdateBanner } from "./components/UpdateBanner";
import { WarningsBar } from "./components/WarningsBar";
import type { Backup } from "./domain/backup";
import { DEFAULT_SORT_DIRECTION, sortCompleted, type CompletedSortKey, type SortDirection } from "./domain/completed";
import { NO_FILTER, availablePlatforms, isFilterActive, matchesFilter, type GameFilter } from "./domain/filters";
import { computeSchedule, plannedGames } from "./domain/schedule";
import { steamConfigured, steamSearchTitle } from "./domain/steam";
import { todayStatus } from "./domain/today";
import { planWarnings } from "./domain/warnings";
import { ALL_PLANS, PLATFORMS, SCHEDULED_PLATFORM, TOGETHER, isDone, planOf, platformOfPlan, type Game, type PlanId, type Platform } from "./domain/types";
import { planLabels, platformLabels, t } from "./i18n/en";
import { setStoreMessages, useStore } from "./state/store";
import { applyTheme } from "./state/theme";
import { useSync } from "./state/sync";
import { useUpdates } from "./state/updates";
import { watchForWebUpdate } from "./platform/pwa";
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
  movedToPlan: (title, together, platform) =>
    together
      ? t.undoNotice.movedToTogether.replace("{title}", title)
      : t.undoNotice.movedToPlan.replace("{title}", title).replace("{platform}", platformLabels[platform]),
  finished: (title, rating, next) =>
    (rating === null
      ? t.undoNotice.finished.replace("{title}", title)
      : t.undoNotice.finishedRated.replace("{title}", title).replace("{rating}", String(rating))) +
    (next ? ` ${t.undoNotice.finishedNext.replace("{next}", next)}` : ""),
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
  /** Bumped when a dialog sends the user to the IGDB credentials; the panel focuses the Client ID field. */
  const [igdbFocus, setIgdbFocus] = useState(0);
  const [plan, setPlan] = useState<PlanId>(SCHEDULED_PLATFORM);
  const [detailsId, setDetailsId] = useState<number | null>(null);
  /** A game whose edit form should open next; the section that owns it picks it up. */
  const [editRequest, setEditRequest] = useState<Game | null>(null);
  const [pendingImport, setPendingImport] = useState<{ name: string; backup: Backup } | null>(null);
  /** Web app: open Settings → Sync at the join form (from a join link, or the empty plan). */
  const [syncRequest, setSyncRequest] = useState<SyncJoinRequest | null>(null);

  function openSyncJoin(key: string | null) {
    setIgdbFocus(0);
    setSettingsOpen(true);
    setSyncRequest((previous) => ({ n: (previous?.n ?? 0) + 1, key }));
  }

  // Web app: a join link (…/#join=KEY) opens the join form with the key filled in. The key leaves the
  // address bar at once, so it is not left in this tab's history or copied along with the page's address.
  useEffect(() => {
    if (!useSync.getState().supported) return;
    const readLink = () => {
      const key = keyInJoinLink(window.location.hash);
      if (key === null) return;
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
      openSyncJoin(key);
    };
    readLink();
    window.addEventListener("hashchange", readLink);
    return () => window.removeEventListener("hashchange", readLink);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Look for a newer release once per start; nothing shows unless there is one.
  useEffect(() => {
    void useUpdates.getState().check(true);
    // Web build: a deployed new version is offered as a reload.
    watchForWebUpdate((apply) => useUpdates.getState().offerReload(apply));
  }, []);

  // Web build: compare with the server copy at start, when the tab comes back, and when the connection returns.
  useEffect(() => {
    if (!useSync.getState().supported) return;
    void useSync.getState().start();
    const check = () => void useSync.getState().check();
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", check);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", check);
    };
  }, []);

  useEffect(() => applyTheme(theme), [theme]);

  // The panel opens above the plan; bring it on screen, and hand focus back to its button when it closes.
  useEffect(() => {
    if (settingsOpen) document.getElementById("settings-panel")?.scrollIntoView({ block: "start" });
  }, [settingsOpen]);

  function toggleSettings() {
    setIgdbFocus(0);
    setSettingsOpen((open) => !open);
  }

  function closeSettings() {
    setIgdbFocus(0);
    setSettingsOpen(false);
    document.querySelector<HTMLElement>('[aria-controls="settings-panel"]')?.focus();
  }

  function openIgdbSetup() {
    setSettingsOpen(true);
    setIgdbFocus((n) => n + 1);
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
      <nav className="skip-links" aria-label={t.skipLinks}>
        <a className="skip-link" href="#completed-heading">
          {t.skipToFinished}
        </a>
        <a className="skip-link" href="#stats-heading">
          {t.skipToStats}
        </a>
      </nav>
      <TopBar settingsOpen={settingsOpen} onToggleSettings={toggleSettings} onExport={() => void exportBackup()} onImport={() => void startImport()} />
      <main>
        {/* A choice about the plan comes before news about the app. */}
        <SyncBanner />
        <UpdateBanner />
        <Banner />
        {settingsOpen && <SettingsPanel onClose={closeSettings} focusIgdb={igdbFocus} syncRequest={syncRequest} />}
        <PlanSection
          plan={plan}
          onPlanChange={setPlan}
          onOpen={(game) => setDetailsId(game.id)}
          onSetupIgdb={openIgdbSetup}
          onJoinSync={() => openSyncJoin(null)}
          editRequest={editRequest}
          onEditHandled={() => setEditRequest(null)}
        />
        <CompletedSection
          defaultPlatform={platformOfPlan(plan)}
          defaultTogether={plan === TOGETHER}
          onOpen={(game) => setDetailsId(game.id)}
          onSetupIgdb={openIgdbSetup}
          editRequest={editRequest}
          onEditHandled={() => setEditRequest(null)}
        />
        <StatsSection />
      </main>
      {detailsId !== null && (
        <GameDetailsDialog
          gameId={detailsId}
          onClose={() => setDetailsId(null)}
          onEdit={(game) => {
            setDetailsId(null);
            setEditRequest(game);
          }}
          onSetupIgdb={() => {
            setDetailsId(null);
            openIgdbSetup();
          }}
        />
      )}
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
  /** `steamName` when adding from the Steam library: it goes into the search and the title. */
  | { kind: "add"; steamName?: string }
  | { kind: "edit"; game: Game }
  | { kind: "delete"; game: Game }
  /** `date` when Steam said when the game was finished (the hints bar). */
  | { kind: "finish"; game: Game; date?: string }
  | { kind: "drop"; game: Game }
  | { kind: "log"; game: Game }
  | null;

interface PlanSectionProps {
  plan: PlanId;
  onPlanChange(plan: PlanId): void;
  onOpen(game: Game): void;
  onSetupIgdb(): void;
  /** Web app: open Settings → Sync at the join form. */
  onJoinSync(): void;
  /** A planned game whose edit form should open (from the details dialog). */
  editRequest: Game | null;
  onEditHandled(): void;
}

const PLAN_PANEL_ID = "plan-panel";

/** True when any game carries IGDB tags or platforms, i.e. when the mode and platform filters can match anything. */
function hasIgdbData(games: readonly Game[]): boolean {
  return games.some((g) => g.providerTags.length > 0 || (g.details?.platforms.length ?? 0) > 0);
}

function PlanSection({ plan, onPlanChange, onOpen, onSetupIgdb, onJoinSync, editRequest, onEditHandled }: PlanSectionProps) {
  const games = useStore((s) => s.games);
  const settings = useStore((s) => s.settings);
  /** Dated sessions: hours played since the plan started count as time already spent. */
  const sessions = useStore((s) => s.sessions);
  const updateSettings = useStore((s) => s.updateSettings);
  const addGame = useStore((s) => s.addGame);
  const editGame = useStore((s) => s.editGame);
  const removeGame = useStore((s) => s.removeGame);
  const moveGame = useStore((s) => s.moveGame);
  const finishGame = useStore((s) => s.finishGame);
  const setGameStatus = useStore((s) => s.setGameStatus);
  const dropGame = useStore((s) => s.dropGame);
  const setTogether = useStore((s) => s.setTogether);
  const [dialog, setDialog] = useState<PlanDialog>(null);
  /** The Steam library list stays open underneath while a game from it is being added. */
  const [steamLibraryOpen, setSteamLibraryOpen] = useState(false);
  const [filter, setFilter] = useState<GameFilter>(NO_FILTER);
  const platforms = useMemo(() => availablePlatforms(games), [games]);
  const filterable = useMemo(() => hasIgdbData(games), [games]);
  /** A web copy with nothing in it and sync off is likely a second device: the empty plan offers to join the first. */
  const canJoin = useSync((s) => s.supported && s.state.kind === "off") && games.length === 0;

  // The details dialog can ask for a planned game's edit form.
  useEffect(() => {
    if (editRequest && !isDone(editRequest)) {
      setDialog({ kind: "edit", game: editRequest });
      onEditHandled();
    }
  }, [editRequest, onEditHandled]);

  // Recomputed on every change to games, settings or logged hours: this is the "live" part.
  const schedule = useMemo(() => computeSchedule(games, settings, sessions), [games, settings, sessions]);
  const today = useMemo(() => todayStatus(schedule, Date.now()), [schedule]);
  const scheduled = plan === SCHEDULED_PLATFORM;
  /** The Together list: games played with others, from any platform, outside the schedule. */
  const together = plan === TOGETHER;

  const rows = useMemo<PlanRowView[]>(
    () =>
      scheduled
        ? schedule.rows.map((row) => ({ game: row.game, index: row.index, schedule: row }))
        : plannedGames(games, plan).map((game, i) => ({ game, index: i + 1, schedule: null })),
    [scheduled, schedule, games, plan],
  );
  const filtering = isFilterActive(filter);
  const visibleRows = useMemo(() => (filtering ? rows.filter((row) => matchesFilter(row.game, filter)) : rows), [rows, filter, filtering]);

  // Long games back to back and series order are about playing alone; the Together list goes by who is free.
  const warnings = useMemo(() => {
    const planned = together ? [] : rows.map((row) => row.game);
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
  }, [rows, together]);

  const planTitles = useMemo(
    () => Object.fromEntries(ALL_PLANS.map((p) => [p, plannedGames(games, p).map((g) => g.title)])) as Record<PlanId, string[]>,
    [games],
  );
  const counts = useMemo(
    () => Object.fromEntries(ALL_PLANS.map((p) => [p, plannedGames(games, p).length])) as Record<PlanId, number>,
    [games],
  );
  const close = () => setDialog(null);
  const leaveForIgdb = () => {
    close();
    onSetupIgdb();
  };
  const planLabel = planLabels[plan];

  const addButton = (
    <button type="button" className="button button-primary" onClick={() => setDialog({ kind: "add" })}>
      <Icon name="plus" /> {t.actions.add}
    </button>
  );
  const steamButton = steamConfigured(settings) && (
    <button type="button" className="button" onClick={() => setSteamLibraryOpen(true)} title={t.steamLibrary.openTitle}>
      <Icon name="download" /> {t.steamLibrary.open}
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
    <EmptyState
      title={t.emptyPlan}
      hint={canJoin ? t.emptyPlanJoinHint : t.emptyPlanHint}
      action={
        canJoin && (
          <button type="button" className="button" onClick={onJoinSync}>
            {t.sync.joinOther}
          </button>
        )
      }
    />
  ) : together ? (
    <EmptyState title={t.emptyTogether} hint={t.emptyTogetherHint} />
  ) : (
    <EmptyState title={t.emptyQueue.replace("{platform}", planLabel)} hint={t.emptyQueueHint.replace("{platform}", planLabel)} />
  );

  return (
    <section className="section" aria-labelledby="plan-heading">
      <div className="section-head">
        <div className="section-title">
          <h2 id="plan-heading">{t.plan}</h2>
          <PlanTabs active={plan} counts={counts} onChange={onPlanChange} panelId={PLAN_PANEL_ID} />
          {addButton}
          {steamButton}
          {!scheduled && <p className="section-hint">{together ? t.togetherHint : t.queueHint}</p>}
        </div>
        {scheduled && <TotalsBar totals={schedule.totals} />}
      </div>
      <div id={PLAN_PANEL_ID} role="tabpanel" aria-labelledby={tabId(plan)}>
        <NowPlaying
          rows={rows}
          today={scheduled ? today : null}
          plan={scheduled ? { startDate: settings.startDate, hoursPerWeek: settings.hoursPerWeek } : null}
          onPlanChange={(patch) => void updateSettings(patch)}
          onOpen={onOpen}
          onFinish={(game) => setDialog({ kind: "finish", game })}
          onLog={(game) => setDialog({ kind: "log", game })}
          onPause={(game) => void setGameStatus(game.id, "paused")}
          onStart={(game) => void setGameStatus(game.id, "in_progress")}
        />
        <WarningsBar messages={warnings.messages} />
        {(scheduled || together) && <SteamHintsBar plan={plan} onFinish={(game, date) => setDialog({ kind: "finish", game, date })} />}
        {rows.length > 0 && filterable && (
          <FilterBar filter={filter} platforms={platforms} shown={visibleRows.length} total={rows.length} onChange={setFilter} />
        )}
        <PlanTable
          rows={visibleRows}
          showSchedule={scheduled}
          showPlatform={together}
          todayGameId={scheduled ? (today.expected?.game.id ?? null) : null}
          cardGameId={rows.find((row) => row.game.status === "in_progress")?.game.id ?? null}
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
          onTogether={(game, value) => void setTogether(game.id, value)}
          onMove={(activeId, overId) => void moveGame(activeId, overId)}
        />
      </div>

      {/* Before the add form, so the form opens on top of the list. */}
      {steamLibraryOpen && (
        <SteamLibraryDialog onAdd={(steamName) => setDialog({ kind: "add", steamName })} onClose={() => setSteamLibraryOpen(false)} />
      )}

      {dialog?.kind === "add" && (
        <GameDialog
          mode="add"
          defaultPlan={dialog.steamName && !together ? SCHEDULED_PLATFORM : plan}
          initialQuery={dialog.steamName ? steamSearchTitle(dialog.steamName) : undefined}
          planTitles={planTitles}
          onSubmit={(values, index) => addGame(values, index)}
          onClose={close}
          onSetupIgdb={leaveForIgdb}
        />
      )}
      {dialog?.kind === "edit" && (
        <GameDialog
          mode="edit"
          game={dialog.game}
          defaultPlan={plan}
          planTitles={planTitles}
          currentIndex={plannedGames(games, planOf(dialog.game)).findIndex((g) => g.id === dialog.game.id)}
          onSubmit={(values, index) => editGame(dialog.game.id, values, index)}
          onClose={close}
          onSetupIgdb={leaveForIgdb}
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
          initialDate={dialog.date}
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

interface CompletedSectionProps {
  defaultPlatform: Platform;
  /** The Together tab is open: a finished game added now was played with others. */
  defaultTogether: boolean;
  onOpen(game: Game): void;
  onSetupIgdb(): void;
  /** A finished game whose edit form should open (from the details dialog). */
  editRequest: Game | null;
  onEditHandled(): void;
}

function CompletedSection({ defaultPlatform, defaultTogether, onOpen, onSetupIgdb, editRequest, onEditHandled }: CompletedSectionProps) {
  const games = useStore((s) => s.games);
  const arrivedId = useStore((s) => s.recentlyFinishedId);
  const filterable = useMemo(() => hasIgdbData(games), [games]);

  useEffect(() => {
    if (editRequest && isDone(editRequest)) {
      setDialog({ kind: "edit", game: editRequest });
      onEditHandled();
    }
  }, [editRequest, onEditHandled]);
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
  const leaveForIgdb = () => {
    close();
    onSetupIgdb();
  };

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
          <h2 id="completed-heading" tabIndex={-1}>
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
      {allCompleted.length > 0 && filterable && (
        <FilterBar filter={modeFilter} platforms={platforms} shown={completed.length} total={allCompleted.length} onChange={setModeFilter} />
      )}
      <CompletedTable
        games={completed}
        canReorder={canReorder}
        empty={empty}
        arrivedId={arrivedId}
        onRate={(game) => setDialog({ kind: "rate", game })}
        onEdit={(game) => setDialog({ kind: "edit", game })}
        onDelete={(game) => setDialog({ kind: "delete", game })}
        onOpen={onOpen}
        onMove={(activeId, overId) => void moveCompleted(activeId, overId)}
      />

      {dialog?.kind === "add" && (
        <CompletedGameDialog
          mode="add"
          defaultPlatform={defaultPlatform}
          defaultTogether={defaultTogether}
          onSubmit={addCompletedGame}
          onClose={close}
          onSetupIgdb={leaveForIgdb}
        />
      )}
      {dialog?.kind === "edit" && (
        <CompletedGameDialog
          mode="edit"
          game={dialog.game}
          defaultPlatform={defaultPlatform}
          onSubmit={(values) => editGame(dialog.game.id, values)}
          onClose={close}
          onSetupIgdb={leaveForIgdb}
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
