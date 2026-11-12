import { useState } from "react";
import { t } from "../i18n/en";
import { Modal } from "./Modal";

interface Props {
  title: string;
  question: string;
  warning?: string;
  confirmLabel: string;
  onConfirm(): Promise<boolean>;
  onClose(): void;
}

/** Destructive confirmation. Focus lands on Cancel, so Enter never deletes by accident. */
export function ConfirmDialog({ title, question, warning, confirmLabel, onConfirm, onClose }: Props) {
  const [busy, setBusy] = useState(false);

  async function confirm() {
    setBusy(true);
    const ok = await onConfirm();
    setBusy(false);
    if (ok) onClose();
  }

  return (
    <Modal title={title} onClose={onClose}>
      <p className="modal-text">{question}</p>
      {warning && <p className="modal-text muted">{warning}</p>}
      <div className="modal-actions">
        <button type="button" className="button" onClick={onClose} disabled={busy}>
          {t.cancel}
        </button>
        <button type="button" className="button button-danger" onClick={() => void confirm()} disabled={busy}>
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
