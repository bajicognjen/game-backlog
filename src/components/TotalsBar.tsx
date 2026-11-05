import { formatDate } from "../domain/dates";
import { formatHours, formatWeeks } from "../domain/format";
import type { ScheduleTotals } from "../domain/schedule";
import type { TodayStatus } from "../domain/today";
import { t } from "../i18n/en";

export function TotalsBar({ totals, today }: { totals: ScheduleTotals; today: TodayStatus }) {
  return (
    <dl className="totals">
      <TodayStat status={today} />
      <Stat label={t.totals.games} value={String(totals.games)} />
      {totals.hoursPlayed > 0 && <Stat label={t.totals.played} value={formatHours(totals.hoursPlayed)} />}
      <Stat label={t.totals.hours} value={formatHours(totals.hours)} />
      <Stat label={t.totals.weeks} value={formatWeeks(totals.weeks)} />
      <Stat label={t.totals.end} value={totals.endMs === null ? t.none : formatDate(totals.endMs)} />
    </dl>
  );
}

function TodayStat({ status }: { status: TodayStatus }) {
  if (status.driftDays === null) {
    return <Stat label={t.today.label} value={t.today.none} tone="muted" />;
  }
  const value =
    status.driftDays === 0
      ? t.today.onTrack
      : status.driftDays > 0
        ? t.today.ahead.replace("{days}", String(status.driftDays))
        : t.today.behind.replace("{days}", String(-status.driftDays));
  const tone = status.driftDays === 0 ? "ok" : status.driftDays > 0 ? "ok" : "warn";
  const detail =
    status.daysToCurrentEnd === null
      ? undefined
      : status.daysToCurrentEnd >= 0
        ? t.today.endsIn.replace("{days}", String(status.daysToCurrentEnd))
        : t.today.overdue.replace("{days}", String(-status.daysToCurrentEnd));
  return <Stat label={t.today.label} value={value} detail={detail} tone={tone} />;
}

function Stat({ label, value, detail, tone }: { label: string; value: string; detail?: string; tone?: "ok" | "warn" | "muted" }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ""}`}>
      <dt>{label}</dt>
      <dd>
        {value}
        {detail && <span className="stat-detail">{detail}</span>}
      </dd>
    </div>
  );
}
