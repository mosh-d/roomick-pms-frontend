/**
 * One CSV cell, safe to open in Excel or Google Sheets. RFC 4180 quoting for
 * commas, quotes and line breaks — and a cell that starts with `=`, `+`, `-`,
 * `@`, a tab or a carriage return is prefixed with an apostrophe, because a
 * spreadsheet would otherwise evaluate it as a formula. Guest names and
 * requests are typed by the public on the booking page, and
 * `=HYPERLINK("http://evil.example","Open me")` exported as a name survives
 * quoting intact. A plain number (`-5.00`) is left alone so refunds add up.
 * Mirrors the API's own `csvCell`.
 */
export function csvCell(value: string | number | boolean | null | undefined): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text) && !/^-?\d+(\.\d+)?$/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** A whole file from rows of cells, with the header first. */
export function toCsv(header: string[], rows: Array<Array<string | number | boolean | null | undefined>>): string {
  return [header.map(csvCell).join(','), ...rows.map((row) => row.map(csvCell).join(','))].join('\n');
}

/** Hands the browser a file to save. */
export function downloadText(filename: string, type: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
