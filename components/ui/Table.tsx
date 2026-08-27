'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { ArrowLeftIcon, ArrowRightIcon, DownloadIcon, SortIcon } from './Icons';
import { Button } from './Button';

export interface TableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
  /**
   * Makes the header sortable and supplies the value to sort/export by.
   * Omit for presentational columns (an action button, a status chip with
   * no meaningful order) — the reference marks exactly these as unsortable
   * too, so "no sortValue" and "no ↑↓ arrows" stay the same decision.
   */
  sortValue?: (row: T) => string | number;
  /** Overrides what CSV export writes for this column; defaults to `sortValue`. Omit both to exclude the column from the export. */
  exportValue?: (row: T) => string | number;
}

const DEFAULT_PAGE_SIZE = 10;

/**
 * The reference's list-page table (Roomick-UI.pdf p11/p18): sortable
 * headers with paired ↑↓ arrows, "← N/N →" pagination bottom-left, and an
 * Export button bottom-right.
 *
 * Sorting and paging are client-side over already-fetched rows — every
 * current caller loads a single branch's arrivals/departures/in-house list
 * in one request, so there's nothing to gain from server-side paging yet
 * and a lot of API surface to add. Revisit if a list ever gets big enough
 * that the fetch itself is the problem, not the render.
 */
export function Table<T extends { id: string }>({
  columns,
  rows,
  emptyMessage,
  pageSize = DEFAULT_PAGE_SIZE,
  exportFileName,
}: {
  columns: TableColumn<T>[];
  rows: T[];
  emptyMessage: string;
  pageSize?: number;
  /** Enables the Export button. Omit to hide it (e.g. a table with nothing meaningful to export). */
  exportFileName?: string;
}) {
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const [page, setPage] = useState(0);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const getValue = col.sortValue;
    // Copy before sorting — `rows` is the caller's React Query data, which
    // must never be mutated in place.
    return [...rows].sort((a, b) => {
      const av = getValue(a);
      const bv = getValue(b);
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  // Clamp rather than reset: deleting the last row of the final page should
  // land on the new final page, not throw the user back to page 1.
  const safePage = Math.min(page, pageCount - 1);
  const visibleRows = sortedRows.slice(safePage * pageSize, safePage * pageSize + pageSize);

  function toggleSort(key: string) {
    setSort((current) => {
      if (current?.key !== key) return { key, dir: 'asc' };
      return current.dir === 'asc' ? { key, dir: 'desc' } : null;
    });
    setPage(0);
  }

  function handleExport() {
    const exportable = columns.filter((c) => c.exportValue ?? c.sortValue);
    const header = exportable.map((c) => csvCell(c.label)).join(',');
    const body = sortedRows
      .map((row) => exportable.map((c) => csvCell(String((c.exportValue ?? c.sortValue)!(row)))).join(','))
      .join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${exportFileName}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  if (rows.length === 0) {
    return <p className="text-body text-secondary-light">{emptyMessage}</p>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-secondary/20">
              {columns.map((col) => (
                <th
                  key={col.key}
                  aria-sort={sort?.key === col.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                  className={`text-small font-bold text-secondary pb-2 pr-4 whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {col.sortValue ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.key)}
                      className={`inline-flex items-center gap-1.5 cursor-pointer hover:text-primary-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-control ${
                        col.align === 'right' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      {col.label}
                      <SortIcon className={`size-3 shrink-0 ${sort?.key === col.key ? 'text-primary-text' : 'text-accent-dark'}`} />
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row) => (
              <tr key={row.id} className="border-b border-secondary/10 last:border-0">
                {columns.map((col) => (
                  <td key={col.key} className={`text-small text-secondary py-3 pr-4 ${col.align === 'right' ? 'text-right' : 'text-left'}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pageCount > 1 || exportFileName ? (
        <div className="flex items-center justify-between gap-4">
          {pageCount > 1 ? (
            <div className="inline-flex items-center gap-3 rounded-control border border-accent/30 px-3 py-1.5">
              <button
                type="button"
                aria-label="Previous page"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
                className="text-secondary disabled:opacity-30 disabled:cursor-default cursor-pointer hover:text-primary-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-control"
              >
                <ArrowLeftIcon className="size-4" />
              </button>
              <span className="text-small text-secondary tabular-nums">
                {safePage + 1} / {pageCount}
              </span>
              <button
                type="button"
                aria-label="Next page"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
                className="text-secondary disabled:opacity-30 disabled:cursor-default cursor-pointer hover:text-primary-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-control"
              >
                <ArrowRightIcon className="size-4" />
              </button>
            </div>
          ) : (
            <span />
          )}
          {exportFileName ? (
            <Button type="button" variant="outline" size="sm" onClick={handleExport}>
              <DownloadIcon className="size-4" />
              Export
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** RFC 4180 quoting — a guest name with a comma would otherwise split into two columns. */
function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
