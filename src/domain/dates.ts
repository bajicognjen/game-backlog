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

/**
 * How long ago a moment was, for a status line: under a minute is "now" (a clock a little ahead
 * counts too), then whole minutes, then whole hours up to a day; null after that, or for something
 * that is not a date, so the caller shows the moment itself.
 */
export function elapsedSince(value: string, now: Date): { unit: "now" } | { unit: "min" | "h"; n: number } | null {
  const ms = now.getTime() - new Date(value).getTime();
  if (Number.isNaN(ms)) return null;
  if (ms < 60_000) return { unit: "now" };
  if (ms < 3_600_000) return { unit: "min", n: Math.floor(ms / 60_000) };
  if (ms < 86_400_000) return { unit: "h", n: Math.floor(ms / 3_600_000) };
  return null;
}

/** A moment (a server timestamp) as people read it here: local `dd.mm.yyyy, HH:mm`. Not a date: the input unchanged. */
export function formatDateTime(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return String(value);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * Parse a typed date, 'dd.mm.yyyy' as the app shows them (single digits and a
 * trailing dot allowed) or ISO, into 'YYYY-MM-DD'. Null when it is not a real date.
 */
export function parseDisplayDate(text: string): string | null {
  const trimmed = text.trim();
  if (isValidIsoDate(trimmed)) return trimmed;
  const match = /^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/.exec(trimmed);
  if (!match) return null;
  const iso = `${match[3]}-${match[2].padStart(2, "0")}-${match[1].padStart(2, "0")}`;
  return isValidIsoDate(iso) ? iso : null;
}

/** Add a (possibly fractional) number of days. */
export function addDays(ms: number, days: number): number {
  return ms + days * MS_PER_DAY;
}

/** The calendar date of a moment on this machine (local time), as 'YYYY-MM-DD'. */
export function localIsoDate(moment: Date): string {
  return `${moment.getFullYear()}-${pad2(moment.getMonth() + 1)}-${pad2(moment.getDate())}`;
}

/** Today's calendar date on this machine (local time), as 'YYYY-MM-DD'. */
export function todayIso(now: Date = new Date()): string {
  return localIsoDate(now);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}
