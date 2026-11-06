import { APP_VERSION } from "../platform/updates";
import { THEME_ORDER } from "../state/theme";
import { useStore } from "../state/store";
import type { Theme } from "../domain/types";
import { t, themeLabels, themeShort } from "../i18n/en";
import { Icon, type IconName } from "./Icon";

const THEME_ICON: Record<Theme, IconName> = { system: "monitor", light: "sun", dark: "moon" };

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
        {/* All three themes are visible; the chosen one is lit, so the next click is never a guess. */}
        <div className="tabs theme-switch" role="radiogroup" aria-label={t.themeTitle}>
          {THEME_ORDER.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={theme === option}
              aria-label={themeLabels[option]}
              title={themeLabels[option]}
              className={`tab ${theme === option ? "tab-active" : ""}`}
              onClick={() => void updateSettings({ theme: option })}
            >
              <Icon name={THEME_ICON[option]} /> {themeShort[option]}
            </button>
          ))}
        </div>
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
