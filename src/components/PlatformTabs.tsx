import { PLAN_PLATFORMS, type Platform } from "../domain/types";
import { platformLabels } from "../i18n/sr";

interface Props {
  active: Platform;
  counts: Record<Platform, number>;
  onChange(platform: Platform): void;
}

export function PlatformTabs({ active, counts, onChange }: Props) {
  return (
    <div className="tabs" role="tablist">
      {PLAN_PLATFORMS.map((platform) => (
        <button
          key={platform}
          type="button"
          role="tab"
          aria-selected={active === platform}
          className={`tab ${active === platform ? "tab-active" : ""}`}
          onClick={() => onChange(platform)}
        >
          {platformLabels[platform]}
          <span className="tab-count">{counts[platform]}</span>
        </button>
      ))}
    </div>
  );
}
