import { t } from "../i18n/en";

interface Props {
  value: number | null;
  onChange(value: number | null): void;
}

/** Ten toggle buttons plus a "no rating" option. */
export function RatingPicker({ value, onChange }: Props) {
  return (
    <div className="rating-picker" role="radiogroup" aria-label={t.rating.label}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          className={`rating-option ${value === n ? "rating-option-active" : ""}`}
          onClick={() => onChange(value === n ? null : n)}
        >
          {n}
        </button>
      ))}
      <button type="button" className="button button-ghost button-small" onClick={() => onChange(null)} disabled={value === null}>
        {t.rating.none}
      </button>
    </div>
  );
}
