/**
 * Live thousands-separator formatting for currency-style number inputs
 * (`30000` → `30,000` as the owner types) — `Intl.NumberFormat`'s grouping,
 * not a hand-rolled regex-insert-commas routine. Re-derives from scratch on
 * every keystroke (the raw typed string, not the last formatted display),
 * the same technique `lib/phone.ts` uses and for the same reason: the only
 * approach that stays correct through mid-value edits (deleting a comma,
 * pasting, backspacing into the middle of a number) without the grouping
 * going out of sync with itself.
 *
 * Caps at 2 decimal places, matching `RoomType.baseRate`'s `Decimal(12,2)`
 * column — typing a 3rd decimal digit just doesn't add it, rather than
 * silently rounding something the owner is mid-typing.
 */
export function formatWithCommas(typed: string): { display: string; value: number | undefined } {
  const cleaned = typed.replace(/[^\d.]/g, '');
  const firstDot = cleaned.indexOf('.');
  const intPart = firstDot === -1 ? cleaned : cleaned.slice(0, firstDot);
  const decPart = firstDot === -1 ? '' : '.' + cleaned.slice(firstDot + 1).replace(/\./g, '').slice(0, 2);

  const groupedInt = intPart ? Number(intPart).toLocaleString('en-US') : '';
  // A bare "." while the owner is mid-typing a decimal (e.g. "30000.")
  // stays visible as-is — reformatting it away here would make it
  // impossible to ever finish typing a decimal value.
  const display = groupedInt + decPart;

  if (cleaned === '' || cleaned === '.') return { display, value: undefined };
  const value = Number(cleaned);
  return { display, value: Number.isNaN(value) ? undefined : value };
}

/** Formats an already-known number for display (e.g. resuming a saved draft) — same grouping, no partial-typing concerns. */
export function displayWithCommas(value: number | undefined): string {
  if (value === undefined || Number.isNaN(value)) return '';
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

/**
 * Formats a money value that arrived from the API as a string (Prisma
 * `Decimal` serialises that way) for display, always to 2dp with grouping.
 *
 * The `Number()` here is display-only and deliberate: the backend is the
 * sole authority on money arithmetic (all `Prisma.Decimal`), and nothing
 * client-side ever computes a balance — it only renders one. Never reuse
 * this to add or compare amounts.
 */
export function formatMoney(value: string | number, currencySymbol = ''): string {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) return String(value);
  // Sign goes OUTSIDE the symbol ("-₦150.00", not "₦-150.00") — format the
  // absolute value and re-attach the minus, since toLocaleString would
  // otherwise leave it stranded between the symbol and the digits.
  const formatted = Math.abs(numeric).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const sign = numeric < 0 ? '-' : '';
  return `${sign}${currencySymbol}${formatted}`;
}
