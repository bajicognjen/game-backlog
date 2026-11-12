import { useState } from "react";
import { t } from "../i18n/en";
import { useStore } from "../state/store";
import { useSync } from "../state/sync";
import { Icon } from "./Icon";
import { SyncConflictDialog } from "./SyncConflictDialog";

/**
 * Sync news that cannot wait for Settings, wherever the user is: a conflict, with the dialog that settles it,
 * and sync that has stopped (the server copy is gone, the server keeps failing, the plan is too big), with a
 * way to Sync. "Waiting" for the connection is normal and stays in Settings.
 */
export function SyncBanner({ onOpenSync }: { onOpenSync(): void }) {
  const state = useSync((s) => s.state);
  /** With Sync on screen in Settings, its own status and announcer tell a stop; a banner would say it twice. */
  const syncPanelOpen = useStore((s) => s.syncPanelOpen);
  const [open, setOpen] = useState(false);
  const conflict = state.kind === "conflict";
  const stopped = syncPanelOpen
    ? null
    : state.kind === "gone"
      ? t.sync.bannerGone
      : state.kind === "pending" && state.reason === "error"
        ? t.sync.bannerFailed
        : state.kind === "pending" && state.reason === "too-large"
          ? t.sync.bannerTooLarge
          : null;
  return (
    <>
      {/* Always on the page and holding only the words, so a screen reader reads the message when a banner
          appears, without the button labels run on after it. */}
      <div className="visually-hidden" role="status">
        {conflict ? t.sync.bannerConflict : (stopped ?? "")}
      </div>
      <div>
        {/* Sync has stopped until a choice is made: the same caution as the other stops, not the routine blue of news. */}
        {conflict && (
          <div className="banner banner-warn">
            <span className="banner-text">
              <Icon name="alert" size={16} className="banner-icon" />
              {t.sync.bannerConflict}
            </span>
            <span className="banner-actions">
              <button type="button" className="button button-primary button-small" onClick={() => setOpen(true)}>
                {t.sync.resolve}
              </button>
            </span>
          </div>
        )}
        {stopped && (
          <div className="banner banner-warn">
            <span className="banner-text">
              <Icon name="alert" size={16} className="banner-icon" />
              {stopped}
            </span>
            <span className="banner-actions">
              <button type="button" className="button button-small" onClick={onOpenSync}>
                {t.sync.openSync}
              </button>
            </span>
          </div>
        )}
      </div>
      {conflict && open && <SyncConflictDialog onClose={() => setOpen(false)} />}
    </>
  );
}
