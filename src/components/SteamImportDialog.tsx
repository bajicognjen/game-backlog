import { useEffect, useMemo, useState } from "react";
import { formatDate } from "../domain/dates";
import { formatHours } from "../domain/format";
import { STEAM_IMPORT_NOTE, importedHours, planSteamImport, type SteamImportPlan } from "../domain/steam";
import { t } from "../i18n/en";
import { ProviderError } from "../platform/http";
import { SteamError, fetchOwnedGames, resolveSteamId, type SteamFailure } from "../platform/steam";
import { useStore } from "../state/store";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

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
  /** Games the user unticked. */
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
        if (controller.signal.aborted) return;
        setExcluded(new Set());
        setStage({ kind: "ready", plan: planSteamImport(games, sessions, owned) });
      } catch (error) {
        if (controller.signal.aborted) return;
        setStage({ kind: "failed", reason: failureOf(error) });
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
            {(selected.length === 1 ? t.steam.confirmOne : t.steam.confirm)
              .replace("{count}", String(selected.length))
              .replace("{hours}", formatHours(hours))}
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

function failureOf(error: unknown): SteamFailure {
  if (error instanceof SteamError) return error.reason;
  if (error instanceof ProviderError && error.reason === "network") return "network";
  return "other";
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
