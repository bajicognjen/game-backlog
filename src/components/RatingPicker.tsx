import type { KeyboardEvent } from "react";
import { t } from "../i18n/en";

interface Props {
  value: number | null;
  onChange(value: number | null): void;
}

/** Ten options as one radio group: one Tab stop, arrow keys move and pick. */
export function RatingPicker({ value, onChange }: Props) {
  const tabStop = value ?? 1;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    // Step from the focused option, so the first arrow press on an unrated game moves off 1.
    const focused = Number((document.activeElement as HTMLElement | null)?.dataset.value);
    const current = Number.isFinite(focused) ? focused : (value ?? 1);
    let next: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowUp") next = Math.min(10, current + 1);
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = Math.max(1, current - 1);
    if (event.key === "Home") next = 1;
    if (event.key === "End") next = 10;
    if (next === null) return;
    event.preventDefault();
    onChange(next);
    event.currentTarget.querySelector<HTMLButtonElement>(`[data-value="${next}"]`)?.focus();
  }

  return (
    <div className="rating-picker" role="radiogroup" aria-label={t.rating.label} onKeyDown={onKeyDown}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          tabIndex={n === tabStop ? 0 : -1}
          data-value={n}
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
