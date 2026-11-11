import { t } from "../i18n/en";
import { useUpdates } from "../state/updates";

/**
 * Desktop: offers a newer release found on GitHub, then shows the download until the app restarts. Web: offers a reload into a new version.
 * The live region is always on the page, so a screen reader reads a banner when it appears, not only when it changes.
 */
export function UpdateBanner() {
  return (
    <div aria-live="polite">
      <UpdateBannerContent />
    </div>
  );
}

function UpdateBannerContent() {
  const status = useUpdates((s) => s.status);
  const version = useUpdates((s) => s.version);
  const progress = useUpdates((s) => s.progress);
  const detail = useUpdates((s) => s.detail);
  const install = useUpdates((s) => s.install);
  const reload = useUpdates((s) => s.reload);
  const dismiss = useUpdates((s) => s.dismiss);

  if (status === "reloadReady") {
    return (
      <div className="banner banner-info">
        <span>{t.updates.webReady}</span>
        <span className="banner-actions">
          <button type="button" className="button button-primary button-small" onClick={reload}>
            {t.updates.reload}
          </button>
          <button type="button" className="button button-ghost button-small" onClick={dismiss}>
            {t.updates.later}
          </button>
        </span>
      </div>
    );
  }

  if (status === "available") {
    return (
      <div className="banner banner-info">
        <span>{t.updates.available.replace("{version}", version ?? "")}</span>
        <span className="banner-actions">
          <button type="button" className="button button-primary button-small" onClick={() => void install()}>
            {t.updates.install}
          </button>
          <button type="button" className="button button-ghost button-small" onClick={dismiss}>
            {t.updates.later}
          </button>
        </span>
      </div>
    );
  }
  if (status === "installing") {
    return (
      <div className="banner banner-info">
        <span>
          {progress === null ? t.updates.downloadingUnknown : t.updates.downloading.replace("{percent}", String(Math.round(progress * 100)))}
        </span>
      </div>
    );
  }
  if (status === "installFailed") {
    return (
      <div className="banner banner-error" role="alert">
        <span>{t.updates.installFailed.replace("{detail}", detail ?? "")}</span>
        <button type="button" className="button button-ghost button-small" onClick={dismiss}>
          {t.dismiss}
        </button>
      </div>
    );
  }
  return null;
}
