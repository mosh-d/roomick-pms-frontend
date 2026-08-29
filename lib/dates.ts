/** `YYYY-MM-DD` the calendar day after `dateStr` — the shared "auto-advance checkout" default every check-in/check-out date-pair form uses. UTC-based so it never drifts a day from a client's own local timezone offset. */
export function dayAfter(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
