import { useEffect, useMemo, useState } from "react";
import { formatDate, todayIso } from "../domain/dates";
import { formatHours } from "../domain/format";
import {
  STEAM_IMPORT_NOTE,
  baseGameAppIds,
  editionCandidates,
  excludedByDefault,
  importedHours,
  planSteamImport,
  type SteamImportPlan,
} from "../domain/steam";
import type { Game, Settings } from "../domain/types";
import { t } from "../i18n/en";
import { SteamError, fetchOwnedGames, resolveSteamId, steamFailureOf, type SteamFailure } from "../platform/steam";
import { providers } from "../state/providers";
import { useStore } from "../state/store";
import { Icon } from "./Icon";
import { Modal } from "./Modal";
import { StatusBadge } from "./StatusBadge";

interface Props {
  onClose(): void;
}

type Stage = { kind: "loading" } | { kind: "failed"; reason: SteamFailure } | { kind: "ready"; plan: SteamImportPlan };

/**
 * Preview, then import: asks Steam for the library, shows every game that
 * would get a session (each can be left out), and writes the chosen ones in
 * one go. The notice afterwards offers to take them back.
 */
export function SteamImportDialog({ onClose }: Props) {
  const logSessions = useStore((s) => s.logSessions);
  const [stage, setStage] = useState<Stage>({ kind: "loading" });
  /** Bumped by "Try again"; the effect fetches once per value. */
  const [attempt, setAttempt] = useState(0);
  /** Games left unticked: the not-started ones at first, then whatever the user changes. */
  const [excluded, setExcluded] = useState<ReadonlySet<number>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setStage({ kind: "loading" });
    void (async () => {
      try {
        const { settings, games, sessions } = useStore.getState();
        const apiKey = settings.steamApiKey.trim();
        if (apiKey === "") throw new SteamError("no-credentials");
        const steamId = await resolveSteamId(apiKey, settings.steamId, controller.signal);
        const owned = await fetchOwnedGames({ apiKey, steamId }, controller.signal);
        const baseApps = await lookUpBaseApps(games, settings, controller.signal);
        if (controller.signal.aborted) return;
        const plan = planSteamImport(games, sessions, owned, todayIso(), baseApps);
        setExcluded(excludedByDefault(plan.items));
        setStage({ kind: "ready", plan });
      } catch (error) {
        if (controller.signal.aborted) return;
        setStage({ kind: "failed", reason: steamFailureOf(error) });
      }
    })();
    return () => controller.abort();
  }, [attempt]);

  const plan = stage.kind === "ready" ? stage.plan : null;
  const selected = useMemo(() => (plan ? plan.items.filter((item) => !excluded.has(item.game.id)) : []), [plan, excluded]);
  const hours = importedHours(selected);

  function toggle(gameId: number, include: boolean) {
    setExcluded((current) => {
      const next = new Set(current);
      if (include) next.delete(gameId);
      else next.add(gameId);
      return next;
    });
  }

  function toggleAll(include: boolean) {
    setExcluded(include || !plan ? new Set() : new Set(plan.items.map((item) => item.game.id)));
  }

  async function confirm() {
    if (selected.length === 0) return;
    setBusy(true);
    const done = (selected.length === 1 ? t.steam.doneOne : t.steam.done)
      .replace("{count}", String(selected.length))
      .replace("{hours}", formatHours(hours));
    const ok = await logSessions(
      selected.map((item) => ({ gameId: item.game.id, playedOn: item.playedOn, hours: item.hours, note: STEAM_IMPORT_NOTE })),
      { done, undone: t.steam.undone },
    );
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal title={t.steam.dialogTitle} onClose={onClose} size="lg">
      {stage.kind === "loading" && (
        <p className="modal-text muted" aria-busy="true">
          {t.steam.loading}
        </p>
      )}

      {stage.kind === "failed" && (
        <p className="modal-text" role="alert">
          {failureMessage(stage.reason)}
        </p>
      )}

      {plan && <Preview plan={plan} excluded={excluded} onToggle={toggle} onToggleAll={toggleAll} />}

      <footer className="modal-actions">
        <button type="button" className="button" onClick={onClose} disabled={busy}>
          {plan && plan.items.length > 0 ? t.cancel : t.close}
        </button>
        {stage.kind === "failed" && stage.reason !== "no-credentials" && (
          <button type="button" className="button" onClick={() => setAttempt((n) => n + 1)}>
            <Icon name="refresh" /> {t.steam.retry}
          </button>
        )}
        {plan && plan.items.length > 0 && (
          <button type="button" className="button button-primary" onClick={() => void confirm()} disabled={busy || selected.length === 0}>
            {confirmLabel(selected.length, hours)}
          </button>
        )}
      </footer>
    </Modal>
  );
}

interface PreviewProps {
  plan: SteamImportPlan;
  excluded: ReadonlySet<number>;
  onToggle(gameId: number, include: boolean): void;
  onToggleAll(include: boolean): void;
}

function Preview({ plan, excluded, onToggle, onToggleAll }: PreviewProps) {
  const matched = plan.items.length + plan.upToDate.length + plan.ahead.length + plan.shared.reduce((n, s) => n + s.games.length, 0);
  const total = matched + plan.unmatched.length;
  const selectedCount = plan.items.filter((item) => !excluded.has(item.game.id)).length;
  const allSelected = selectedCount === plan.items.length;
  const titles = (games: readonly { title: string }[]) => games.map((g) => `“${g.title}”`).join(", ");
  // A game with nothing logged brings its whole Steam total in one session.
  const firstImport = plan.items.some((item) => item.loggedHours === 0);

  return (
    <>
      <p className="modal-text">{t.steam.matched.replace("{matched}", String(matched)).replace("{total}", String(total))}</p>
      <p className="modal-text muted">{t.steam.howItWorks}</p>

      {plan.items.length === 0 ? (
        <p className="modal-text">{t.steam.nothingToAdd}</p>
      ) : (
        <table className="table steam-table">
          <thead>
            <tr>
              <th scope="col">
                <input
                  type="checkbox"
                  aria-label={t.steam.selectAll}
                  checked={allSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = selectedCount > 0 && !allSelected;
                  }}
                  onChange={(e) => onToggleAll(e.target.checked)}
                />
              </th>
              <th scope="col">{t.steam.colGame}</th>
              <th scope="col">{t.steam.colStatus}</th>
              <th scope="col" className="num">
                {t.steam.colLogged}
              </th>
              <th scope="col" className="num">
                {t.steam.colSteam}
              </th>
              <th scope="col" className="num">
                {t.steam.colAdd}
              </th>
              <th scope="col" className="date">
                {t.steam.colDate}
              </th>
            </tr>
          </thead>
          <tbody>
            {plan.items.map((item) => (
              <tr key={item.game.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={t.steam.selectGame.replace("{title}", item.game.title)}
                    checked={!excluded.has(item.game.id)}
                    onChange={(e) => onToggle(item.game.id, e.target.checked)}
                  />
                </td>
                <td className="title">
                  {item.game.title}
                  {item.matchedBy === "title" && <span className="steam-by"> · {t.steam.byTitle}</span>}
                  {item.notStarted && <span className="steam-why">{t.steam.notStartedHint}</span>}
                </td>
                <td>
                  <StatusBadge status={item.game.status} />
                </td>
                <td className="num">{formatHours(item.loggedHours)} h</td>
                <td className="num">{formatHours(item.steamHours)} h</td>
                <td className="num">+{formatHours(item.hours)} h</td>
                <td className="date">{formatDate(item.playedOn)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {firstImport && <p className="steam-stats-note">{t.steam.statsNote}</p>}

      {(plan.upToDate.length > 0 || plan.ahead.length > 0 || plan.shared.length > 0 || plan.unmatched.length > 0) && (
        <ul className="steam-notes">
          {plan.upToDate.length > 0 && <li>{t.steam.upToDate.replace("{titles}", titles(plan.upToDate.map((m) => m.game)))}</li>}
          {plan.ahead.length > 0 && <li>{t.steam.ahead.replace("{titles}", titles(plan.ahead.map((m) => m.game)))}</li>}
          {plan.shared.map((shared) => (
            <li key={shared.steam.appid}>{t.steam.shared.replace("{titles}", titles(shared.games)).replace("{steam}", shared.steam.name)}</li>
          ))}
          {plan.unmatched.length > 0 && (
            <li>
              {t.steam.unmatched.replace("{titles}", titles(plan.unmatched))} {t.steam.unmatchedHint}
            </li>
          )}
        </ul>
      )}
    </>
  );
}

/**
 * Steam apps of the base games behind editions whose cached details have no
 * Steam link. Optional like all IGDB enrichment: without IGDB set up, or
 * when it fails, those games just fall back to their titles.
 */
async function lookUpBaseApps(games: readonly Game[], settings: Settings, signal: AbortSignal): Promise<Map<number, number>> {
  const ids = editionCandidates(games);
  if (ids.length === 0 || !providers.igdb.configured(settings)) return new Map();
  try {
    return baseGameAppIds(games, await providers.igdb.editionBaseLinks(ids, signal));
  } catch (error) {
    if (signal.aborted) throw error;
    return new Map();
  }
}

/** The import button: what it will add, or what to do when nothing is ticked. */
function confirmLabel(count: number, hours: number): string {
  if (count === 0) return t.steam.confirmNone;
  return (count === 1 ? t.steam.confirmOne : t.steam.confirm).replace("{count}", String(count)).replace("{hours}", formatHours(hours));
}

function failureMessage(reason: SteamFailure): string {
  switch (reason) {
    case "no-credentials":
      return t.steam.errors.noCredentials;
    case "unauthorized":
      return t.steam.errors.unauthorized;
    case "unknown-account":
      return t.steam.errors.unknownAccount;
    case "private":
      return t.steam.errors.private;
    case "network":
      return t.steam.errors.network;
    default:
      return t.steam.errors.other;
  }
}
