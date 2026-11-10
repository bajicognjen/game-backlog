import { useState } from "react";
import { t } from "../i18n/en";
import { useSync } from "../state/sync";
import { Modal } from "./Modal";

/** When this device and the server both changed: the user picks a side; nothing is merged. */
export function SyncConflictDialog({ onClose }: { onClose(): void }) {
  const state = useSync((s) => s.state);
  const resolve = useSync((s) => s.resolve);
  const [busy, setBusy] = useState(false);
  if (state.kind !== "conflict") return null;

  async function choose(choice: "keep-mine" | "take-server") {
    setBusy(true);
    await resolve(choice);
    setBusy(false);
    onClose();
  }

  return (
    <Modal title={t.sync.conflictTitle} onClose={onClose}>
      <p className="modal-text">{t.sync.conflictText.replace("{time}", formatWhen(state.remote.updatedAt))}</p>
      <footer className="modal-actions">
        <button type="button" className="button" onClick={onClose} disabled={busy} data-autofocus>
          {t.sync.later}
        </button>
        <button type="button" className="button" onClick={() => void choose("take-server")} disabled={busy}>
          {t.sync.takeServer}
        </button>
        <button type="button" className="button button-primary" onClick={() => void choose("keep-mine")} disabled={busy}>
          {t.sync.keepMine}
        </button>
      </footer>
    </Modal>
  );
}

/** A server timestamp for people: local date and time. */
export function formatWhen(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short" });
}
