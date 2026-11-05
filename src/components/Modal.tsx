import { useEffect, useRef, type ReactNode } from "react";
import { t } from "../i18n/en";

interface Props {
  title: string;
  onClose(): void;
  children: ReactNode;
  /** Wider dialog for content-heavy views. */
  wide?: boolean;
}

/** Native <dialog> shown modally; Escape, the backdrop and the ✕ button close it. */
export function Modal({ title, onClose, children, wide = false }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={`modal ${wide ? "modal-wide" : ""}`}
      aria-labelledby="modal-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
    >
      <div className="modal-content">
        <header className="modal-head">
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="button button-ghost button-icon" onClick={onClose} aria-label={t.close}>
            ✕
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
