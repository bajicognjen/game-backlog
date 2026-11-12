import type { KeyboardEvent } from "react";
import { PLAN_TABS, type PlanId } from "../domain/types";
import { planLabels, t } from "../i18n/en";

interface Props {
  active: PlanId;
  counts: Record<PlanId, number>;
  onChange(plan: PlanId): void;
  /** Id of the element the tabs control. */
  panelId: string;
}

export function tabId(plan: PlanId): string {
  return `plan-tab-${plan}`;
}

/** One Tab stop; Left/Right (and Home/End) move between the plans: PC, PS5 and Together. */
export function PlanTabs({ active, counts, onChange, panelId }: Props) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const index = PLAN_TABS.indexOf(active);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % PLAN_TABS.length;
    if (event.key === "ArrowLeft") next = (index - 1 + PLAN_TABS.length) % PLAN_TABS.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = PLAN_TABS.length - 1;
    if (next === null) return;
    event.preventDefault();
    const plan = PLAN_TABS[next];
    onChange(plan);
    document.getElementById(tabId(plan))?.focus();
  }

  return (
    <div className="tabs" role="tablist" aria-label={t.plan} onKeyDown={onKeyDown}>
      {PLAN_TABS.map((plan) => {
        const selected = active === plan;
        return (
          <button
            key={plan}
            id={tabId(plan)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId}
            tabIndex={selected ? 0 : -1}
            className={`tab ${selected ? "tab-active" : ""}`}
            onClick={() => onChange(plan)}
          >
            {planLabels[plan]}
            <span className="tab-count">{counts[plan]}</span>
          </button>
        );
      })}
    </div>
  );
}
