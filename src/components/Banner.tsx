import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent } from "react";
import { UNDO_WINDOW_MS, useStore } from "../state/store";
import { t } from "../i18n/en";

/**
 * Error and success messages from the store, each dismissible. An undo
 * offer takes focus when it appears, so Undo is the next Tab stop and a
 * screen reader hears it; the seconds left are shown next to Undo and a
 * line drains under the notice, both pausing while the user is on the offer.
 */
export function Banner() {
  const error = useStore((s) => s.error);
  const notice = useStore((s) => s.notice);
  const undo = useStore((s) => s.undo);
  const undoHeld = useStore((s) => s.undoHeld);
  const undoDeadline = useStore((s) => s.undoDeadline);
  const recentlyFinishedId = useStore((s) => s.recentlyFinishedId);
  const undoLast = useStore((s) => s.undoLast);
  const pauseUndo = useStore((s) => s.pauseUndo);
  const resumeUndo = useStore((s) => s.resumeUndo);
  const dismissError = useStore((s) => s.dismissError);
  const dismissNotice = useStore((s) => s.dismissNotice);
  const noticeRef = useRef<HTMLDivElement>(null);
  /** Whether focus is inside the notice; kept by hand because a removed element fires no blur. */
  const focusWithin = useRef(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

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
    // When the offer goes (expiry, undo, dismiss) while focus is still on it, hand focus to the current game.
    return () => {
      timers.forEach(clearTimeout);
      if (focusWithin.current || node.contains(document.activeElement)) {
        focusWithin.current = false;
        focusCard();
      }
    };
  }, [undo]);

  // The visible countdown: ticks while the offer runs, freezes while it is held.
  useEffect(() => {
    if (!undo) {
      setSecondsLeft(null);
      return;
    }
    if (undoDeadline === null) return;
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((undoDeadline - Date.now()) / 1000)));
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [undo, undoDeadline]);

  function onNoticeFocus() {
    focusWithin.current = true;
  }

  function onNoticeBlur(event: FocusEvent<HTMLDivElement>) {
    // A move to another element means focus left; a null target may be the element vanishing, so keep the flag.
    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) focusWithin.current = false;
  }

  function showFinished() {
    if (recentlyFinishedId === null) return;
    const row = document.getElementById(`game-${recentlyFinishedId}`);
    row?.scrollIntoView({ block: "center" });
    row?.querySelector<HTMLElement>(".title-cell-link")?.focus({ preventScroll: true });
  }

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
          onFocus={onNoticeFocus}
          onBlur={onNoticeBlur}
        >
          <span>{notice}</span>
          <span className="banner-actions">
            {undo && recentlyFinishedId !== null && (
              <button type="button" className="button button-ghost button-small" onClick={showFinished} onFocus={pauseUndo} onBlur={resumeUndo}>
                {t.showFinished}
              </button>
            )}
            {undo && (
              <>
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
                {secondsLeft !== null && (
                  <span className="banner-count" aria-hidden="true">
                    {secondsLeft} s
                  </span>
                )}
              </>
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
