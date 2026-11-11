import { useEffect, useState } from "react";
import { formatDateTime } from "../domain/dates";
import { formatHours } from "../domain/format";
import { t } from "../i18n/en";
import type { ConflictSide, ConflictSides } from "../platform/sync";
import { useSync } from "../state/sync";
import { Modal } from "./Modal";

interface CompareRow {
  label: string;
  device: string;
  server: string;
  /** Which values to set in bold: both where the counts differ, the newer one for the change time. */
  strong: { device: boolean; server: boolean };
}

/**
 * When this device and the server both changed, or a device that already has a plan joins a key:
 * the user compares the two copies and picks one. Nothing is merged, and neither choice is favoured.
 */
export function SyncConflictDialog({ onClose }: { onClose(): void }) {
  const state = useSync((s) => s.state);
  const resolve = useSync((s) => s.resolve);
  const conflictSides = useSync((s) => s.conflictSides);
  const [busy, setBusy] = useState(false);
  const [sides, setSides] = useState<ConflictSides | null>(null);
  const remote = state.kind === "conflict" ? state.remote : null;

  useEffect(() => {
    let current = true;
    void conflictSides().then((next) => {
      if (current) setSides(next);
    });
    return () => {
      current = false;
    };
  }, [remote, conflictSides]);

  if (state.kind !== "conflict") return null;

  async function choose(choice: "keep-mine" | "take-server") {
    setBusy(true);
    await resolve(choice);
    setBusy(false);
    onClose();
  }

  // A device that joined a key while holding a plan of its own has never synced: there is no "since".
  const lead = state.meta.lastSyncedAt ? t.sync.conflictSince.replace("{time}", formatDateTime(state.meta.lastSyncedAt)) : t.sync.conflictFirst;

  return (
    <Modal title={t.sync.conflictTitle} onClose={onClose}>
      <p className="modal-text">{lead}</p>
      <table className="sync-compare">
        <thead>
          <tr>
            <td />
            <th scope="col">{t.sync.compareDevice}</th>
            <th scope="col">{t.sync.compareServer}</th>
          </tr>
        </thead>
        <tbody>
          {compareRows(sides).map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td className={row.strong.device ? "sync-compare-strong" : undefined}>{row.device}</td>
              <td className={row.strong.server ? "sync-compare-strong" : undefined}>{row.server}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="modal-text">{t.sync.conflictOutcome}</p>
      <footer className="modal-actions modal-actions-stack">
        <button type="button" className="button button-ghost" onClick={onClose} disabled={busy} data-autofocus>
          {t.sync.later}
        </button>
        {/* Same order as the table's columns: this device, then the server. */}
        <button type="button" className="button" onClick={() => void choose("keep-mine")} disabled={busy}>
          {t.sync.keepMine}
        </button>
        <button type="button" className="button" onClick={() => void choose("take-server")} disabled={busy}>
          {t.sync.takeServer}
        </button>
      </footer>
    </Modal>
  );
}

/** The comparison table's rows; dashes until the two copies are read (or when the server's can't be). */
function compareRows(sides: ConflictSides | null): CompareRow[] {
  const count = (label: string, value: (side: ConflictSide) => number, show: (n: number) => string = String): CompareRow => {
    if (!sides) return { label, device: "–", server: "–", strong: { device: false, server: false } };
    const differs = value(sides.device) !== value(sides.server);
    return { label, device: show(value(sides.device)), server: show(value(sides.server)), strong: { device: differs, server: differs } };
  };
  const changedAt = (side: ConflictSide | undefined) => (side?.changedAt ? formatDateTime(side.changedAt) : "–");
  const deviceTime = sides?.device.changedAt ? Date.parse(sides.device.changedAt) : NaN;
  const serverTime = sides?.server.changedAt ? Date.parse(sides.server.changedAt) : NaN;
  return [
    count(t.sync.compareInPlan, (side) => side.inPlan),
    count(t.sync.compareFinished, (side) => side.finished),
    count(t.sync.compareHours, (side) => side.hoursLogged, formatHours),
    {
      label: t.sync.compareChanged,
      device: changedAt(sides?.device),
      server: changedAt(sides?.server),
      strong: { device: deviceTime > serverTime, server: serverTime > deviceTime },
    },
  ];
}
