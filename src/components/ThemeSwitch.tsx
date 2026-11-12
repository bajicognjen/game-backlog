import { useRef } from "react";
import type { Theme } from "../domain/types";
import { t, themeLabels, themeShort } from "../i18n/en";
import { useStore } from "../state/store";
import { THEME_ORDER } from "../state/theme";
import { Icon, type IconName } from "./Icon";
import { useRovingGroup } from "./useRoving";

const THEME_ICON: Record<Theme, IconName> = { system: "monitor", light: "sun", dark: "moon" };

/**
 * System, Light and Dark as one segmented control. All three are visible and the chosen one is lit, so the
 * next click is never a guess. It sits in the top bar from 900px up and in Settings below that, where the
 * bar's room goes to Sync.
 */
export function ThemeSwitch({ className = "" }: { className?: string }) {
  const theme = useStore((s) => s.settings.theme);
  const updateSettings = useStore((s) => s.updateSettings);
  const switchRef = useRef<HTMLDivElement>(null);
  // One Tab stop; Left/Right move and pick, like a native radio group.
  const roving = useRovingGroup(switchRef, { selector: '[role="radio"]', entry: '[aria-checked="true"]', activateOnMove: true });

  return (
    <div ref={switchRef} className={`tabs theme-switch ${className}`} role="radiogroup" aria-label={t.themeTitle} onFocus={roving.onFocus} onKeyDown={roving.onKeyDown}>
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
          <Icon name={THEME_ICON[option]} /> <span className="label">{themeShort[option]}</span>
        </button>
      ))}
    </div>
  );
}
