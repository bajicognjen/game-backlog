import { useMemo, useState } from "react";
import { formatHours } from "../domain/format";
import { computeStats, type GroupStat, type MonthBucket } from "../domain/stats";
import { genreLabels, monthLabels, t, typeLabels } from "../i18n/en";
import { useStore } from "../state/store";
import { Icon } from "./Icon";
import { Stat } from "./TotalsBar";

/** Finished games and logged hours per month, plus ratings by type and genre. Collapsed by default. */
export function StatsSection() {
  const games = useStore((s) => s.games);
  const sessions = useStore((s) => s.sessions);
  const [open, setOpen] = useState(false);
  const stats = useMemo(() => computeStats(games, sessions), [games, sessions]);

  return (
    <section className="section" aria-labelledby="stats-heading">
      <div className="section-head">
        <div className="section-title">
          <h2 id="stats-heading">{t.stats.title}</h2>
          <button type="button" className="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="stats-panel">
            <Icon name={open ? "chevron-up" : "chevron-down"} /> {open ? t.stats.hide : t.stats.show}
          </button>
        </div>
        <dl className="totals">
          <Stat label={t.stats.finished} value={String(stats.finishedTotal)} />
          {stats.droppedTotal > 0 && <Stat label={t.stats.dropped} value={String(stats.droppedTotal)} />}
          <Stat label={t.stats.hoursLogged} value={formatHours(stats.hoursLoggedTotal)} />
          <Stat label={t.stats.avgRating} value={stats.avgRating === null ? t.none : `${stats.avgRating} / 10`} />
        </dl>
      </div>

      {open && (
        <div id="stats-panel" className="stats-grid">
          <div className="card stats-card">
            <h3>{t.stats.finishedPerMonth}</h3>
            <Bars months={stats.months} value={(m) => m.finished} format={(v) => String(v)} />
          </div>
          <div className="card stats-card">
            <h3>{t.stats.hoursPerMonth}</h3>
            <Bars months={stats.months} value={(m) => m.hours} format={formatHours} />
          </div>
          <div className="card stats-card">
            <h3>{t.stats.byType}</h3>
            <GroupTable rows={stats.byType} label={(k) => typeLabels[k]} />
          </div>
          <div className="card stats-card">
            <h3>{t.stats.byGenre}</h3>
            <GroupTable rows={stats.byGenre} label={(k) => genreLabels[k]} />
          </div>
        </div>
      )}
    </section>
  );
}

function Bars({ months, value, format }: { months: MonthBucket[]; value(m: MonthBucket): number; format(v: number): string }) {
  const max = Math.max(...months.map(value), 0);
  if (max === 0) return <p className="muted">{t.stats.empty}</p>;
  return (
    <div className="bars">
      {months.map((m) => {
        const v = value(m);
        const [year, month] = m.month.split("-");
        return (
          <div key={m.month} className="bar-col" title={`${monthLabels[Number(month) - 1]} ${year}: ${format(v)}`}>
            <span className="bar-value">{v > 0 ? format(v) : ""}</span>
            <span className="bar" style={{ height: `${Math.round((v / max) * 100)}%` }} />
            <span className="bar-label">
              {monthLabels[Number(month) - 1]}
              {month === "01" || m === months[0] ? <span className="muted"> {year.slice(2)}</span> : null}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function GroupTable<K extends string>({ rows, label }: { rows: GroupStat<K>[]; label(k: K): string }) {
  if (rows.length === 0) return <p className="muted">{t.stats.empty}</p>;
  return (
    <table className="table stats-table">
      <thead>
        <tr>
          <th scope="col" />
          <th scope="col" className="num">
            {t.stats.count}
          </th>
          <th scope="col" className="num">
            {t.columns.rating}
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <td>{label(row.key)}</td>
            <td className="num">{row.count}</td>
            <td className="num">{row.avgRating === null ? t.none : row.avgRating}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
