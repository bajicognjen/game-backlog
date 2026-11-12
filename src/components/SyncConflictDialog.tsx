import { useEffect, useId, useState, type ReactNode } from "react";
import { formatDateTime } from "../domain/dates";
import { formatHours } from "../domain/format";
import { titlesOnlyIn } from "../domain/sync";
import { t } from "../i18n/en";
import type { ConflictSide, ConflictSides } from "../platform/sync";
import { useStore, type NoticePlace } from "../state/store";
import { useSync } from "../state/sync";
import { Icon } from "./Icon";
import { Modal } from "./Modal";

interface CompareRow {
  label: string;
  device: ReactNode;
  server: ReactNode;
  /** Which values to set in bold: both where the counts differ, the newer one for the change time. */
  strong: { device: boolean; server: boolean };
}

/**
 * When this device and the server both changed, or a device that already has a plan joins a key:
 * the user compares the two copies and picks one. Nothing is merged, and neither choice is favoured.
 */
export function SyncConflictDialog({ onClose, place = "top" }: { onClose(): void; place?: NoticePlace }) {
  const state = useSync((s) => s.state);
  const resolve = useSync((s) => s.resolve);
  const exportBackup = useStore((s) => s.exportBackup);
  const conflictSides = useSync((s) => s.conflictSides);
  const [busy, setBusy] = useState(false);
  const [sides, setSides] = useState<ConflictSides | null>(null);
  const remote = state.kind === "conflict" ? state.remote : null;
  const leadId = useId();
  const outcomeId = useId();

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
    // Its result and Undo show where the dialog was opened from.
    await resolve(choice, place);
    setBusy(false);
    onClose();
  }

  // A device that joined a key while holding a plan of its own has never synced: there is no "since".
  const lead = state.meta.lastSyncedAt ? t.sync.conflictSince.replace("{time}", formatDateTime(state.meta.lastSyncedAt)) : t.sync.conflictFirst;

  return (
    <Modal title={t.sync.conflictTitle} onClose={onClose} describedBy={`${leadId} ${outcomeId}`}>
      <p className="modal-text" id={leadId}>
        {lead}
      </p>
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
      {/* The totals can match while the games differ: name what choosing the other copy would lose. */}
      {sides && <SyncDiff sides={sides} />}
      <button type="button" className="button button-ghost button-small sync-export" onClick={() => void exportBackup()}>
        <Icon name="download" size={14} /> {t.sync.exportFirst}
      </button>
      <p className="modal-text" id={outcomeId}>
        {t.sync.conflictOutcome}
      </p>
      <div className="modal-actions modal-actions-stack">
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
      </div>
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
  const deviceTime = sides?.device.changedAt ? Date.parse(sides.device.changedAt) : NaN;
  const serverTime = sides?.server.changedAt ? Date.parse(sides.server.changedAt) : NaN;
  // Two changes in the same minute would read as the same time with one marked newer: show the seconds then.
  const sameMinute =
    sides?.device.changedAt && sides.server.changedAt ? formatDateTime(sides.device.changedAt) === formatDateTime(sides.server.changedAt) : false;
  const changedAt = (side: ConflictSide | undefined) => (side?.changedAt ? <ChangeTime iso={side.changedAt} seconds={sameMinute && deviceTime !== serverTime} /> : "–");
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

/** "12.11.2026, 12:53" as a date and a time that can stack on a narrow phone; with seconds when two changes share a minute. */
function ChangeTime({ iso, seconds }: { iso: string; seconds: boolean }) {
  const [date, time] = formatDateTime(iso).split(", ");
  if (time === undefined) return <>{date}</>; // not a readable time: shown as stored
  const withSeconds = seconds ? `${time}:${String(new Date(iso).getSeconds()).padStart(2, "0")}` : time;
  return (
    <>
      {date},{" "}
      <span className="sync-compare-time">{withSeconds}</span>
    </>
  );
}

/** How many titles a line names before "+N more": enough to recognise the copy, short enough for a phone. */
const TITLES_SHOWN = 3;

/** "Only on this device: …" and "Only on the server: …", or a line saying both have the same games. */
function SyncDiff({ sides }: { sides: ConflictSides }) {
  const here = titlesOnlyIn(sides.device.titles, sides.server.titles);
  const there = titlesOnlyIn(sides.server.titles, sides.device.titles);
  if (here.length === 0 && there.length === 0) {
    return (
      <div className="sync-diffs">
        <p className="sync-diff muted">{t.sync.sameGames}</p>
      </div>
    );
  }
  const line = (label: string, titles: string[]) =>
    titles.length > 0 && (
      <p className="sync-diff">
        <span className="sync-diff-label">{label}</span> {titles.slice(0, TITLES_SHOWN).join(", ")}
        {titles.length > TITLES_SHOWN && <span className="muted"> ({t.sync.moreTitles.replace("{n}", String(titles.length - TITLES_SHOWN))})</span>}
      </p>
    );
  return (
    <div className="sync-diffs">
      {line(t.sync.onlyHere, here)}
      {line(t.sync.onlyThere, there)}
    </div>
  );
}
