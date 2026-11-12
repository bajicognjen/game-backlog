import { APP_VERSION } from "../platform/updates";
import { t } from "../i18n/en";
import { useSync } from "../state/sync";
import { Icon } from "./Icon";
import { statusOf, sinceText } from "./syncStatus";
import { ThemeSwitch } from "./ThemeSwitch";

interface Props {
  settingsOpen: boolean;
  onToggleSettings(): void;
  onExport(): void;
  onImport(): void;
  /** Bring Settings → Sync into view (web app only). */
  onOpenSync(): void;
}

export function TopBar({ settingsOpen, onToggleSettings, onExport, onImport, onOpenSync }: Props) {
  const syncSupported = useSync((s) => s.supported);

  return (
    <header className="topbar">
      <div className="topbar-brand">
        <h1>{t.appTitle}</h1>
        <span className="version-tag" title={t.updates.installed}>
          v{APP_VERSION}
        </span>
      </div>
      <div className="topbar-actions">
        <button type="button" className="button button-ghost" onClick={onExport} title={t.backup.exportTitle}>
          <Icon name="download" /> <span className="label">{t.backup.export}</span>
        </button>
        <button type="button" className="button button-ghost" onClick={onImport} title={t.backup.importTitle}>
          <Icon name="upload" /> <span className="label">{t.backup.import}</span>
        </button>
        <span className="topbar-divider" aria-hidden="true" />
        <ThemeSwitch className="topbar-theme" />
        {syncSupported && <SyncButton onOpen={onOpenSync} />}
        <button
          type="button"
          className={`button ${settingsOpen ? "button-active" : ""}`}
          onClick={onToggleSettings}
          aria-expanded={settingsOpen}
          aria-controls="settings-panel"
          title={t.settings.open}
        >
          <Icon name="sliders" /> <span className="label">{t.settings.open}</span>
        </button>
      </div>
    </header>
  );
}

/**
 * Sync's health from anywhere: a cloud with the state's dot (the same word and tone as Settings → Sync),
 * no dot while sync is off. It opens Settings at Sync, where the state is explained and acted on.
 */
function SyncButton({ onOpen }: { onOpen(): void }) {
  const state = useSync((s) => s.state);
  const status = state.kind === "off" ? null : statusOf(state);
  // The name says the state, so a screen reader hears it without opening Settings; the time is in the tooltip.
  const name = status ? t.sync.topbarName.replace("{state}", status.word) : t.sync.topbarOff;
  const tooltip = status?.when ? `${name}, ${sinceText(status.when, new Date())}` : name;
  return (
    <button type="button" className="button button-ghost topbar-sync" onClick={onOpen} aria-label={name} title={tooltip}>
      <span className="topbar-sync-icon">
        <Icon name="cloud" />
        {status && <span className={`topbar-sync-dot topbar-sync-dot-${status.tone}`} aria-hidden="true" />}
      </span>
      <span className="label">{t.sync.title}</span>
    </button>
  );
}
