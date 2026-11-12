import { useState } from "react";
import { t } from "../i18n/en";
import { useSync } from "../state/sync";
import { SyncConflictDialog } from "./SyncConflictDialog";

/** Surfaces a sync conflict wherever the user is, with the dialog that settles it. */
export function SyncBanner() {
  const state = useSync((s) => s.state);
  const [open, setOpen] = useState(false);
  const conflict = state.kind === "conflict";
  return (
    <>
      {/* Always on the page, so a screen reader reads the banner when it appears; the dialog stays outside it. */}
      <div aria-live="polite">
        {conflict && (
          <div className="banner banner-info">
            <span>{t.sync.bannerConflict}</span>
            <span className="banner-actions">
              <button type="button" className="button button-primary button-small" onClick={() => setOpen(true)}>
                {t.sync.resolve}
              </button>
            </span>
          </div>
        )}
      </div>
      {conflict && open && <SyncConflictDialog onClose={() => setOpen(false)} />}
    </>
  );
}
