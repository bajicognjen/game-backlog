import { APP_VERSION } from "../platform/updates";
import { nextTheme } from "../state/theme";
import { useStore } from "../state/store";
import { t, themeLabels } from "../i18n/en";
import { Icon, type IconName } from "./Icon";

const THEME_ICON: Record<keyof typeof themeLabels, IconName> = { system: "monitor", light: "sun", dark: "moon" };

interface Props {
  settingsOpen: boolean;
  onToggleSettings(): void;
  onExport(): void;
  onImport(): void;
}

export function TopBar({ settingsOpen, onToggleSettings, onExport, onImport }: Props) {
  const theme = useStore((s) => s.settings.theme);
  const updateSettings = useStore((s) => s.updateSettings);
  const next = nextTheme(theme);

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
          <Icon name="download" /> {t.backup.export}
        </button>
        <button type="button" className="button button-ghost" onClick={onImport} title={t.backup.importTitle}>
          <Icon name="upload" /> {t.backup.import}
        </button>
        <span className="topbar-divider" aria-hidden="true" />
        <button
          type="button"
          className="button button-ghost"
          onClick={() => void updateSettings({ theme: next })}
          title={t.themeSwitch.replace("{theme}", themeLabels[next].toLowerCase())}
          aria-label={`${themeLabels[theme]}. ${t.themeSwitch.replace("{theme}", themeLabels[next].toLowerCase())}`}
        >
          <Icon name={THEME_ICON[theme]} /> {themeLabels[theme]}
        </button>
        <button
          type="button"
          className={`button ${settingsOpen ? "button-active" : ""}`}
          onClick={onToggleSettings}
          aria-expanded={settingsOpen}
          aria-controls="settings-panel"
        >
          <Icon name="sliders" /> {t.settings.open}
        </button>
      </div>
    </header>
  );
}
