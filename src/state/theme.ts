import type { Theme } from "../domain/types";

/**
 * Apply the chosen theme to the document. "system" removes the attribute so
 * the CSS falls back to `prefers-color-scheme`.
 */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  if (theme === "system") {
    delete root.dataset.theme;
  } else {
    root.dataset.theme = theme;
  }
}

/** The order the top bar's theme switch shows them in. */
export const THEME_ORDER: readonly Theme[] = ["system", "light", "dark"];
