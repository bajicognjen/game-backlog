import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { UNDO_WINDOW_MS, useStore } from "../state/store";
import { t } from "../i18n/en";

/**
 * Error and success messages from the store, each dismissible. An undo
 * offer takes focus when it appears, so Undo is the next Tab stop and a
 * screen reader hears it; a thin line under it drains over the window and
 * waits while the pointer or keyboard is on the offer.
 */
export function Banner() {
  const error = useStore((s) => s.error);
  const notice = useStore((s) => s.notice);
  const undo = useStore((s) => s.undo);
  const undoHeld = useStore((s) => s.undoHeld);
  const undoLast = useStore((s) => s.undoLast);
  const pauseUndo = useStore((s) => s.pauseUndo);
  const resumeUndo = useStore((s) => s.resumeUndo);
  const dismissError = useStore((s) => s.dismissError);
  const dismissNotice = useStore((s) => s.dismissNotice);
  const noticeRef = useRef<HTMLDivElement>(null);

  /** The notice's buttons vanish with it; send focus to the current game before acting. */
  function focusCard() {
    document.querySelector<HTMLElement>(".now .link-button, .now .button")?.focus({ preventScroll: true });
  }

  useLayoutEffect(() => {
    if (!undo) return;
    const node = noticeRef.current;
    if (!node) return;
    // The offer appears while the dialog that caused it may still be open; a modal dialog makes the
    // page inert and focus() is ignored, so try again a few times after it has closed.
    const tryFocus = () => {
      if (document.activeElement !== node) node.focus({ preventScroll: true });
      return document.activeElement === node;
    };
    const timers = tryFocus() ? [] : [60, 200, 450].map((ms) => setTimeout(tryFocus, ms));
    // When the offer goes while focus is still on it, hand focus to the current game rather than dropping it.
    return () => {
      timers.forEach(clearTimeout);
      if (node.contains(document.activeElement)) {
        document.querySelector<HTMLElement>(".now .link-button, .now .button")?.focus({ preventScroll: true });
      }
    };
  }, [undo]);

  return (
    <>
      {error && (
        <div className="banner banner-error" role="alert">
          <span>{error}</span>
          <button type="button" className="button button-ghost" onClick={dismissError}>
            {t.dismiss}
          </button>
        </div>
      )}
      {notice && (
        <div
          ref={noticeRef}
          tabIndex={-1}
          className={`banner banner-info ${undo ? "banner-undo" : ""} ${undoHeld ? "banner-held" : ""}`}
          role="status"
          style={{ "--undo-ms": `${UNDO_WINDOW_MS}ms` } as CSSProperties}
          onMouseEnter={undo ? pauseUndo : undefined}
          onMouseLeave={undo ? resumeUndo : undefined}
        >
          <span>{notice}</span>
          <span className="banner-actions">
            {undo && (
              <button
                type="button"
                className="button button-primary button-small"
                onClick={() => {
                  focusCard();
                  void undoLast();
                }}
                onFocus={pauseUndo}
                onBlur={resumeUndo}
              >
                {t.undo}
              </button>
            )}
            <button
              type="button"
              className="button button-ghost"
              onClick={() => {
                focusCard();
                dismissNotice();
              }}
              onFocus={undo ? pauseUndo : undefined}
              onBlur={undo ? resumeUndo : undefined}
            >
              {t.dismiss}
            </button>
          </span>
          {undo && <span className="banner-drain" aria-hidden="true" />}
        </div>
      )}
    </>
  );
}
