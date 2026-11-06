import type { KeyboardEvent } from "react";
import { PLAN_PLATFORMS, type Platform } from "../domain/types";
import { platformLabels, t } from "../i18n/en";

interface Props {
  active: Platform;
  counts: Record<Platform, number>;
  onChange(platform: Platform): void;
  /** Id of the element the tabs control. */
  panelId: string;
}

export function tabId(platform: Platform): string {
  return `plan-tab-${platform}`;
}

/** One Tab stop; Left/Right (and Home/End) move between platforms. */
export function PlatformTabs({ active, counts, onChange, panelId }: Props) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = PLAN_PLATFORMS.indexOf(active);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % PLAN_PLATFORMS.length;
    if (event.key === "ArrowLeft") next = (index - 1 + PLAN_PLATFORMS.length) % PLAN_PLATFORMS.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = PLAN_PLATFORMS.length - 1;
    if (next === null) return;
    event.preventDefault();
    const platform = PLAN_PLATFORMS[next];
    onChange(platform);
    document.getElementById(tabId(platform))?.focus();
  }

  return (
    <div className="tabs" role="tablist" aria-label={t.plan} onKeyDown={onKeyDown}>
      {PLAN_PLATFORMS.map((platform) => {
        const selected = active === platform;
        return (
          <button
            key={platform}
            id={tabId(platform)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            className={`tab ${selected ? "tab-active" : ""}`}
            onClick={() => onChange(platform)}
          >
            {platformLabels[platform]}
            <span className="tab-count">{counts[platform]}</span>
          </button>
        );
      })}
    </div>
  );
}
