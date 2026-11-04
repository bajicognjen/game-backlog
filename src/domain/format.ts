/** Hours: integers as-is, otherwise one decimal (12.5). */
export function formatHours(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

/** Weeks always with one decimal, like the sheet (69.3). */
export function formatWeeks(weeks: number): string {
  return weeks.toFixed(1);
}
