import { APP_VERSION } from "../platform/updates";
import { nextTheme } from "../state/theme";
import { useStore } from "../state/store";
import { t, themeLabels } from "../i18n/en";

const THEME_ICON = { system: "◐", light: "☀", dark: "☾" } as const;

interface Props {
  settingsOpen: boolean;
  onToggleSettings(): void;
  onExport(): void;
  onImport(): void;
}

export function TopBar({ settingsOpen, onToggleSettings, onExport, onImport }: Props) {
  const theme = useStore((s) => s.settings.theme);
  const updateSettings = useStore((s) => s.updateSettings);

  return (
    <header className="topbar">
      <h1>
        {t.appTitle}
        <span className="version-tag" title={t.updates.installed}>
          v{APP_VERSION}
        </span>
      </h1>
      <div className="topbar-actions">
        <button type="button" className="button button-ghost" onClick={onExport} title={t.backup.exportTitle}>
          ⤓ {t.backup.export}
        </button>
        <button type="button" className="button button-ghost" onClick={onImport} title={t.backup.importTitle}>
          ⤒ {t.backup.import}
        </button>
        <span className="topbar-divider" aria-hidden="true" />
        <button
          type="button"
          className="button button-ghost"
          onClick={() => void updateSettings({ theme: nextTheme(theme) })}
          title={themeLabels[theme]}
          aria-label={themeLabels[theme]}
        >
          <span aria-hidden="true">{THEME_ICON[theme]}</span> {themeLabels[theme]}
        </button>
        <button
          type="button"
          className={`button ${settingsOpen ? "button-active" : ""}`}
          onClick={onToggleSettings}
          aria-expanded={settingsOpen}
          aria-controls="settings-panel"
        >
          {t.settings.open}
        </button>
      </div>
    </header>
  );
}
