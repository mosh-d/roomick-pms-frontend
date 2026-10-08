/** `YYYY-MM-DD` the calendar day after `dateStr` — the shared "auto-advance checkout" default every check-in/check-out date-pair form uses. UTC-based so it never drifts a day from a client's own local timezone offset. */
export function dayAfter(dateStr: string): string {
  return addDays(dateStr, 1);
}

/** `YYYY-MM-DD` shifted by whole days, with no timezone involved. */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Today's calendar date where the viewer is — the front desk's own day. The
 * old `new Date().toISOString().slice(0, 10)` was the UTC date, which in
 * Lagos is still yesterday until one in the morning (and in Houston until
 * six in the evening), so report ranges and "arriving now" switched a day
 * early or late.
 */
export function todayLocal(): string {
  return new Date().toLocaleDateString('en-CA');
}

/**
 * A business date (`YYYY-MM-DD`, or an ISO timestamp read as its UTC calendar
 * day) shown in the viewer's locale WITHOUT the browser's timezone moving it.
 * `new Date('2026-10-08').toLocaleDateString()` is 7 October to anyone west
 * of Greenwich; this is 8 October to everyone.
 */
export function formatDateOnly(value: string | Date | null | undefined, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return '';
  const iso = value instanceof Date ? value.toISOString() : value;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return String(value);
  const day = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return day.toLocaleDateString(undefined, { timeZone: 'UTC', ...options });
}
