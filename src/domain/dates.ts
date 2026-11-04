/**
 * Date helpers.
 *
 * All arithmetic is done on UTC milliseconds so that one "day" is always
 * exactly 24 hours, the way a spreadsheet serial date behaves. Calendar dates
 * travel through the app as ISO strings (YYYY-MM-DD) and are shown as
 * dd.MM.yyyy. Fractional days are kept until display, where they are floored.
 */

export const MS_PER_DAY = 86_400_000;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Parse 'YYYY-MM-DD' into UTC milliseconds at midnight. Throws on bad input. */
export function parseIsoDate(iso: string): number {
  const match = ISO_DATE.exec(iso);
  if (!match) throw new Error(`Invalid ISO date: ${iso}`);
  const ms = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  // Date.UTC silently rolls 2026-02-30 over to March; reject that.
  if (toIsoDate(ms) !== iso) throw new Error(`Invalid ISO date: ${iso}`);
  return ms;
}

export function isValidIsoDate(iso: string): boolean {
  try {
    parseIsoDate(iso);
    return true;
  } catch {
    return false;
  }
}

/** Floor UTC milliseconds to the start of that UTC day. */
export function floorToDay(ms: number): number {
  return Math.floor(ms / MS_PER_DAY) * MS_PER_DAY;
}

/** Floor to the day and return 'YYYY-MM-DD'. */
export function toIsoDate(ms: number): string {
  const d = new Date(floorToDay(ms));
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Format as dd.MM.yyyy. Accepts an ISO string or UTC milliseconds (floored). */
export function formatDate(value: number | string): string {
  const ms = typeof value === "string" ? parseIsoDate(value) : floorToDay(value);
  const d = new Date(ms);
  return `${pad2(d.getUTCDate())}.${pad2(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

/** Add a (possibly fractional) number of days. */
export function addDays(ms: number, days: number): number {
  return ms + days * MS_PER_DAY;
}

/** Today's calendar date on this machine (local time), as 'YYYY-MM-DD'. */
export function todayIso(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
