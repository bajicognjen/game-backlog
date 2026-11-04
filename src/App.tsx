import { useEffect, useMemo, useState } from "react";
import { Banner } from "./components/Banner";
import { CompletedGameDialog } from "./components/CompletedGameDialog";
import { CompletedTable } from "./components/CompletedTable";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { FinishDialog } from "./components/FinishDialog";
import { GameDialog } from "./components/GameDialog";
import { PlanTable, type PlanRowView } from "./components/PlanTable";
import { PlatformTabs } from "./components/PlatformTabs";
import { RatingDialog } from "./components/RatingDialog";
import { SettingsPanel } from "./components/SettingsPanel";
import { SortControl } from "./components/SortControl";
import { TopBar } from "./components/TopBar";
import { TotalsBar } from "./components/TotalsBar";
import type { Backup } from "./domain/backup";
import { DEFAULT_SORT_DIRECTION, sortCompleted, type CompletedSortKey, type SortDirection } from "./domain/completed";
import { computeSchedule, plannedGames } from "./domain/schedule";
import { PLATFORMS, SCHEDULED_PLATFORM, type Game, type Platform } from "./domain/types";
import { platformLabels, t } from "./i18n/sr";
import { setStoreMessages, useStore } from "./state/store";
import { applyTheme } from "./state/theme";
import "./styles/app.css";

setStoreMessages({
  exported: t.backup.exported,
  imported: t.backup.imported,
  invalidBackup: (path, reason) =>
    t.backup.invalid.replace("{path}", path).replace("{reason}", t.backup.reasons[reason] ?? reason),
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
  const [pendingImport, setPendingImport] = useState<{ name: string; backup: Backup } | null>(null);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => applyTheme(theme), [theme]);

  async function startImport() {
    const picked = await pickBackup();
    if (picked) setPendingImport(picked);
  }

  if (status === "loading") {
    return <main className="screen muted">{t.loading}</main>;
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
        <Banner />
        {settingsOpen && <SettingsPanel />}
        <PlanSection platform={platform} onPlatformChange={setPlatform} />
        <CompletedSection defaultPlatform={platform} />
      </main>
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
  | null;

interface PlanSectionProps {
  platform: Platform;
  onPlatformChange(platform: Platform): void;
}

function PlanSection({ platform, onPlatformChange }: PlanSectionProps) {
  const games = useStore((s) => s.games);
  const settings = useStore((s) => s.settings);
  const addGame = useStore((s) => s.addGame);
  const editGame = useStore((s) => s.editGame);
  const removeGame = useStore((s) => s.removeGame);
  const moveGame = useStore((s) => s.moveGame);
  const finishGame = useStore((s) => s.finishGame);
  const setGameStatus = useStore((s) => s.setGameStatus);
  const [dialog, setDialog] = useState<PlanDialog>(null);

  // Recomputed on every change to games or settings: this is the "live" part.
  const schedule = useMemo(() => computeSchedule(games, settings), [games, settings]);
  const scheduled = platform === SCHEDULED_PLATFORM;

  const rows = useMemo<PlanRowView[]>(
    () =>
      scheduled
        ? schedule.rows.map((row) => ({ game: row.game, index: row.index, schedule: row }))
        : plannedGames(games, platform).map((game, i) => ({ game, index: i + 1, schedule: null })),
    [scheduled, schedule, games, platform],
  );

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

  return (
    <section className="section">
      <div className="section-head">
        <div className="section-title">
          <PlatformTabs active={platform} counts={counts} onChange={onPlatformChange} />
          <button type="button" className="button button-primary" onClick={() => setDialog({ kind: "add" })}>
            + {t.actions.add}
          </button>
        </div>
        {scheduled ? <TotalsBar totals={schedule.totals} /> : <p className="hint section-hint">{t.queueHint}</p>}
      </div>
      <PlanTable
        rows={rows}
        showSchedule={scheduled}
        emptyText={scheduled ? t.emptyPlan : t.emptyQueue}
        onEdit={(game) => setDialog({ kind: "edit", game })}
        onDelete={(game) => setDialog({ kind: "delete", game })}
        onFinish={(game) => setDialog({ kind: "finish", game })}
        onStatus={(game, status) => void setGameStatus(game.id, status)}
        onMove={(activeId, overId) => void moveGame(activeId, overId)}
      />

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

function CompletedSection({ defaultPlatform }: { defaultPlatform: Platform }) {
  const games = useStore((s) => s.games);
  const addCompletedGame = useStore((s) => s.addCompletedGame);
  const editGame = useStore((s) => s.editGame);
  const rateGame = useStore((s) => s.rateGame);
  const removeGame = useStore((s) => s.removeGame);
  const moveCompleted = useStore((s) => s.moveCompleted);
  const [sortKey, setSortKey] = useState<CompletedSortKey>("order");
  const [direction, setDirection] = useState<SortDirection>(DEFAULT_SORT_DIRECTION.order);
  const [filter, setFilter] = useState<Platform | "all">("all");
  const [dialog, setDialog] = useState<CompletedDialog>(null);

  const completed = useMemo(
    () => sortCompleted(games, sortKey, direction).filter((game) => filter === "all" || game.platform === filter),
    [games, sortKey, direction, filter],
  );
  const canReorder = sortKey === "order" && filter === "all";
  const close = () => setDialog(null);

  return (
    <section className="section">
      <div className="section-head">
        <div className="section-title">
          <h2>
            {t.completed} <span className="count">{completed.length}</span>
          </h2>
          <button type="button" className="button" onClick={() => setDialog({ kind: "add" })}>
            + {t.actions.addCompleted}
          </button>
        </div>
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
      </div>
      <CompletedTable
        games={completed}
        canReorder={canReorder}
        onRate={(game) => setDialog({ kind: "rate", game })}
        onEdit={(game) => setDialog({ kind: "edit", game })}
        onDelete={(game) => setDialog({ kind: "delete", game })}
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
