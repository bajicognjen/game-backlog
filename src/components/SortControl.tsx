import { DEFAULT_SORT_DIRECTION, type CompletedSortKey, type SortDirection } from "../domain/completed";
import { t } from "../i18n/en";
import { Icon } from "./Icon";

interface Props {
  sortKey: CompletedSortKey;
  direction: SortDirection;
  onChange(sortKey: CompletedSortKey, direction: SortDirection): void;
}

const KEYS: CompletedSortKey[] = ["order", "date", "rating"];

export function SortControl({ sortKey, direction, onChange }: Props) {
  const directionLabel = direction === "asc" ? t.sort.asc : t.sort.desc;
  return (
    <div className="sort-control">
      <label className="sort-label">
        <span>{t.sort.label}</span>
        <select
          value={sortKey}
          onChange={(e) => {
            const key = e.target.value as CompletedSortKey;
            onChange(key, DEFAULT_SORT_DIRECTION[key]);
          }}
        >
          {KEYS.map((key) => (
            <option key={key} value={key}>
              {t.sort[key]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="button button-icon-sm"
        onClick={() => onChange(sortKey, direction === "asc" ? "desc" : "asc")}
        title={directionLabel}
        aria-label={directionLabel}
      >
        <Icon name={direction === "asc" ? "arrow-up" : "arrow-down"} />
      </button>
    </div>
  );
}
