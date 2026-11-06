import { useEffect, useRef, type ReactNode } from "react";
import { t } from "../i18n/en";
import { Icon } from "./Icon";

/** Controls that can take the first focus; the close button comes last in the DOM and is skipped. */
const FOCUSABLE =
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]):not(.modal-close), [tabindex]:not([tabindex="-1"])';

interface Props {
  title: string;
  onClose(): void;
  children: ReactNode;
  /** md for confirmations and short forms, lg for the game forms, xl for content-heavy views. */
  size?: "md" | "lg" | "xl";
}

/**
 * Native <dialog> shown modally; Escape, the backdrop and the ✕ button close it.
 * Focus goes to the element marked `data-autofocus` (else the first control)
 * and returns to whatever opened the dialog when it closes.
 */
export function Modal({ title, onClose, children, size = "md" }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog && !dialog.open) dialog.showModal();
    const first = dialog?.querySelector<HTMLElement>("[data-autofocus]") ?? dialog?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();
    return () => {
      dialog?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`modal modal-${size}`}
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
        <h2 id="modal-title" className="modal-title">
          {title}
        </h2>
        {children}
        <button type="button" className="button button-ghost button-icon-sm modal-close" onClick={onClose} aria-label={t.close} title={t.close}>
          <Icon name="x" />
        </button>
      </div>
    </dialog>
  );
}
