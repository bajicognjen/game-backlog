import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type FocusEvent } from "react";
import { UNDO_WINDOW_MS, useStore, type NoticePlace } from "../state/store";
import { t } from "../i18n/en";
import { useAnyDialogOpen } from "./useAnyDialogOpen";

/**
 * Error and success messages from the store, each dismissible. An undo
 * offer takes focus when it appears, so Undo is the next Tab stop and a
 * screen reader hears it; the seconds left are shown next to Undo and a
 * line drains under the notice, both pausing while the user is on the offer.
 * A routine confirmation pauses its clock the same way.
 *
 * `place` "top" is the page's banner; "sync" sits inside Settings → Sync and
 * shows the notices of actions taken there, which the top one then leaves out
 * (it takes them back if Sync closes). A notice in Sync takes focus too and
 * stays while Sync is open. Errors always show at the top.
 *
 * A notice that takes focus is read out by it; one that doesn't is read from a
 * hidden status that holds only its words, never its buttons. Whenever a notice
 * goes while focus is on it, focus moves on to where the user is.
 */
export function Banner({ place = "top" }: { place?: NoticePlace }) {
  const error = useStore((s) => s.error);
  const storedNotice = useStore((s) => s.notice);
  const storedUndo = useStore((s) => s.undo);
  const undoHeld = useStore((s) => s.undoHeld);
  const undoDeadline = useStore((s) => s.undoDeadline);
  const recentlyFinishedId = useStore((s) => s.recentlyFinishedId);
  const undoLast = useStore((s) => s.undoLast);
  const pauseUndo = useStore((s) => s.pauseUndo);
  const resumeUndo = useStore((s) => s.resumeUndo);
  const pauseNotice = useStore((s) => s.pauseNotice);
  const resumeNotice = useStore((s) => s.resumeNotice);
  const dismissError = useStore((s) => s.dismissError);
  const dismissNotice = useStore((s) => s.dismissNotice);
  const noticePlace = useStore((s) => s.noticePlace);
  const syncPanelOpen = useStore((s) => s.syncPanelOpen);
  const here = noticePlace === place || (place === "top" && noticePlace === "sync" && !syncPanelOpen);
  const notice = here ? storedNotice : null;
  const undo = here ? storedUndo : null;
  const takesFocus = undo !== null || place === "sync";
  /** Born at the top and not focused: the only notices the hidden status reads out. */
  const announced = notice !== null && !takesFocus && noticePlace === "top" ? notice : "";
  const hold = undo ? pauseUndo : pauseNotice;
  const release = undo ? resumeUndo : resumeNotice;
  const noticeRef = useRef<HTMLDivElement>(null);
  /** Whether focus is inside the notice; kept by hand because a removed element fires no blur. */
  const focusWithin = useRef(false);
  /**
   * The notice's clock waits while the user is on it: the pointer over it, keyboard focus anywhere in it (the box
   * itself too, where it lands when it appears), or a dialog open over the page. Focus a mouse click left there
   * doesn't hold it, or a mouse user's clock would never run.
   */
  const hovered = useRef(false);
  const keyboardOn = useRef(false);
  const dialogOpen = useAnyDialogOpen();
  function holdOrRelease() {
    if (hovered.current || keyboardOn.current || dialogOpen) hold();
    else release();
  }
  useEffect(() => {
    if (notice) holdOrRelease();
    // Only the dialog and the notice itself change what holds the clock here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen, notice, undo]);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  /**
   * The notice's buttons vanish with it; send focus on before acting: to the current game at the top,
   * to the Sync group's first control in Settings, where the user is.
   */
  function focusCard() {
    if (place === "sync") {
      document.querySelector<HTMLElement>("#sync-settings .settings-group-body > :not(.banner) button:not(:disabled)")?.focus({ preventScroll: true });
      return;
    }
    document.querySelector<HTMLElement>(".now .link-button, .now .button")?.focus({ preventScroll: true });
  }

  useLayoutEffect(() => {
    if (!notice) return;
    const node = noticeRef.current;
    if (!node) return;
    // The offer appears while the dialog that caused it may still be open; a modal dialog makes the
    // page inert and focus() is ignored, so try again a few times after it has closed.
    // At the top the page stays where it is (the action may be far below); in Sync the notice is where the user is.
    const tryFocus = () => {
      if (document.activeElement !== node) node.focus({ preventScroll: place === "top" });
      return document.activeElement === node;
    };
    const timers = !takesFocus || tryFocus() ? [] : [60, 200, 450].map((ms) => setTimeout(tryFocus, ms));
    // When the notice goes (expiry, undo, dismiss, a newer one) while focus is still on it, hand focus on.
    return () => {
      timers.forEach(clearTimeout);
      if (focusWithin.current || node.contains(document.activeElement)) {
        focusWithin.current = false;
        focusCard();
      }
    };
  }, [notice, undo]);

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

  function onNoticeFocus(event: FocusEvent<HTMLDivElement>) {
    focusWithin.current = true;
    keyboardOn.current = isFocusVisible(event.target);
    holdOrRelease();
  }

  function onNoticeBlur(event: FocusEvent<HTMLDivElement>) {
    // A move to another element means focus left; a null target may be the element vanishing, so keep the flag.
    if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) {
      focusWithin.current = false;
      keyboardOn.current = false;
      holdOrRelease();
    }
  }

  function showFinished() {
    if (recentlyFinishedId === null) return;
    const row = document.getElementById(`game-${recentlyFinishedId}`);
    row?.scrollIntoView({ block: "center" });
    row?.querySelector<HTMLElement>(".title-cell-link")?.focus({ preventScroll: true });
  }

  return (
    <>
      <div className="visually-hidden" role="status">
        {announced}
      </div>
      {error && place === "top" && (
        <div className="banner banner-error" role="alert">
          <span>{error}</span>
          <button type="button" className="button button-ghost button-small" onClick={dismissError}>
            {t.dismiss}
          </button>
        </div>
      )}
      {notice && (
        <div
          ref={noticeRef}
          tabIndex={-1}
          className={`banner banner-info ${undo ? "banner-undo" : ""} ${undoHeld ? "banner-held" : ""}`}
          style={{ "--undo-ms": `${UNDO_WINDOW_MS}ms` } as CSSProperties}
          onMouseEnter={() => {
            hovered.current = true;
            holdOrRelease();
          }}
          onMouseLeave={() => {
            hovered.current = false;
            holdOrRelease();
          }}
          onFocus={onNoticeFocus}
          onBlur={onNoticeBlur}
        >
          <span>
            {notice}
            {/* The time limit, heard once with the notice: the visible count is not read out as it ticks. */}
            {undo && <span className="visually-hidden"> {t.undoWindow.replace("{seconds}", String(Math.round(UNDO_WINDOW_MS / 1000)))}</span>}
          </span>
          <span className="banner-actions">
            {undo && recentlyFinishedId !== null && place === "top" && (
              <button type="button" className="button button-ghost button-small" onClick={showFinished}>
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
                    // Undoing can replace the control focus went to (sync turning back on); land again when it is done.
                    void undoLast().then(() => {
                      if (document.activeElement === document.body || document.activeElement === null) focusCard();
                    });
                  }}
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
              className="button button-ghost button-small"
              onClick={() => {
                focusCard();
                dismissNotice();
              }}
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

/** Whether focus got here from the keyboard (or assistive tech), not from a click. */
function isFocusVisible(target: EventTarget): boolean {
  try {
    return target instanceof Element && target.matches(":focus-visible");
  } catch {
    return true; // no :focus-visible: treat focus as the user being on it
  }
}
