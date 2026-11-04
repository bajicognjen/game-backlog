import { useStore } from "../state/store";
import { t } from "../i18n/sr";

/** Error and success messages from the store, each dismissible. */
export function Banner() {
  const error = useStore((s) => s.error);
  const notice = useStore((s) => s.notice);
  const dismissError = useStore((s) => s.dismissError);
  const dismissNotice = useStore((s) => s.dismissNotice);

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
        <div className="banner banner-info" role="status">
          <span>{notice}</span>
          <button type="button" className="button button-ghost" onClick={dismissNotice}>
            {t.dismiss}
          </button>
        </div>
      )}
    </>
  );
}
