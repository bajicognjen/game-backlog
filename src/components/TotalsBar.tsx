import { formatDate } from "../domain/dates";
import { formatHours, formatWeeks } from "../domain/format";
import type { ScheduleTotals } from "../domain/schedule";
import { t } from "../i18n/sr";

export function TotalsBar({ totals }: { totals: ScheduleTotals }) {
  return (
    <dl className="totals">
      <Stat label={t.totals.games} value={String(totals.games)} />
      <Stat label={t.totals.hours} value={formatHours(totals.hours)} />
      <Stat label={t.totals.weeks} value={formatWeeks(totals.weeks)} />
      <Stat label={t.totals.end} value={totals.endMs === null ? t.none : formatDate(totals.endMs)} />
    </dl>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
