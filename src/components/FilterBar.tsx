import { MODE_FILTERS, isFilterActive, toggleMode, type GameFilter } from "../domain/filters";
import { t } from "../i18n/sr";

interface Props {
  filter: GameFilter;
  platforms: string[];
  shown: number;
  total: number;
  onChange(filter: GameFilter): void;
}

/** Mode toggles and a platform dropdown; reordering is off while a filter is active. */
export function FilterBar({ filter, platforms, shown, total, onChange }: Props) {
  const active = isFilterActive(filter);
  return (
    <div className="filter-bar">
      <span className="muted">{t.filters.label}</span>
      {MODE_FILTERS.map((mode) => (
        <button
          key={mode}
          type="button"
          className={`chip chip-toggle ${filter.modes.includes(mode) ? "chip-toggle-on" : ""}`}
          aria-pressed={filter.modes.includes(mode)}
          onClick={() => onChange(toggleMode(filter, mode))}
        >
          {mode}
        </button>
      ))}
      <select
        value={filter.platform ?? ""}
        onChange={(e) => onChange({ ...filter, platform: e.target.value === "" ? null : e.target.value })}
        aria-label={t.filters.platform}
        disabled={platforms.length === 0}
      >
        <option value="">{t.filters.anyPlatform}</option>
        {platforms.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      {active && (
        <>
          <span className="muted">{t.filters.shown.replace("{shown}", String(shown)).replace("{total}", String(total))}</span>
          <button type="button" className="button button-ghost button-small" onClick={() => onChange({ modes: [], platform: null })}>
            {t.filters.clear}
          </button>
          <span className="muted filter-note">{t.filters.noReorder}</span>
        </>
      )}
    </div>
  );
}
