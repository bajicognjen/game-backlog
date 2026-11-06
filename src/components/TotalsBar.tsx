import { formatDate } from "../domain/dates";
import { formatHours, formatWeeks } from "../domain/format";
import type { ScheduleTotals } from "../domain/schedule";
import { t } from "../i18n/en";

/** The plan in two numbers; the count sits on the platform tab and the day-to-day status on the Now playing card. */
export function TotalsBar({ totals }: { totals: ScheduleTotals }) {
  return (
    <dl className="totals">
      <Stat
        label={t.totals.end}
        value={totals.endMs === null ? t.none : formatDate(totals.endMs)}
        detail={totals.endMs === null ? undefined : t.totals.weeks.replace("{weeks}", formatWeeks(totals.weeks))}
      />
      <Stat
        label={t.totals.hours}
        value={formatHours(totals.hours)}
        detail={totals.hoursPlayed > 0 ? t.totals.playedDetail.replace("{played}", formatHours(totals.hoursPlayed)) : undefined}
      />
    </dl>
  );
}

export function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="stat">
      <dt>{label}</dt>
      <dd>
        {value}
        {detail && <span className="stat-detail">{detail}</span>}
      </dd>
    </div>
  );
}
