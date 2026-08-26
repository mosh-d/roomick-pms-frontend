import type { ReactNode } from 'react';

export interface TableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right';
}

/**
 * A small, generic table — header row + body rows, no sorting/pagination.
 * The app had no table primitive before Arrivals/Departures/In-House Guest
 * List all needed one at once; worth building once rather than three near-
 * duplicate markups. Sits on a `tone="secondary"` surface by convention
 * (reusing `Card.tsx`'s tone system via the caller wrapping this), matching
 * the reference's own table pages (In-House Guest List, Arrivals Dashboard).
 */
export function Table<T extends { id: string }>({
  columns,
  rows,
  emptyMessage,
}: {
  columns: TableColumn<T>[];
  rows: T[];
  emptyMessage: string;
}) {
  if (rows.length === 0) {
    return <p className="text-body text-secondary-light">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-secondary/20">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`text-small font-bold text-secondary pb-2 pr-4 whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
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
  );
}
