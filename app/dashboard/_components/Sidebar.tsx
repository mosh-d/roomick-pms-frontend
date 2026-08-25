'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The Front Desk sidebar (Roomick-UI.pdf pages 10 & 19). Reuses
 * `WizardShell.tsx`'s own row/active-state classes rather than a second,
 * separately-tuned copy — same shared-styling discipline that page's own
 * header comments establish for this codebase.
 *
 * Only two real pages exist right now: the Front Desk hub itself
 * (`/dashboard`) and Room Status Board (`/dashboard/room-status-board`),
 * reached through the "In-House Management" group. Every other row (Check-
 * In, Check-Out, In-House Guest List, Reservations, Housekeeping, Billing
 * and Payments, Folio Transfer, Point of Sale, Shift Management, No-Show
 * Handling, Guest Registration Card, Comms Log) has zero backend behind it
 * yet (see PHASE_NOTES.md's "backend build order") — rendered as plain,
 * non-interactive rows so the documented architecture is still visible,
 * without pretending any of them lead somewhere.
 *
 * "In-House Management" only expands to show its children while a page
 * inside it is actually open — matching `WizardShell`'s own "only the
 * active section auto-expands" rule (driven by the current route, not a
 * static default) — collapsed to a single row everywhere else, including
 * on the hub page itself.
 */
const INERT_ROWS = ['Check-In', 'Check-Out'];
const OPERATIONS_ROWS = [
  'Reservations',
  'Housekeeping',
  'Billing and Payments',
  'Folio Transfer',
  'Point of Sale',
  'Shift Management',
  'No-Show Handling',
  'Guest Registration Card',
  'Comms Log',
];

export function Sidebar() {
  const pathname = usePathname();
  const inRoomStatusBoard = pathname === '/dashboard/room-status-board';

  return (
    <aside className="w-60 shrink-0 overflow-y-auto border-r border-accent/20 px-4 py-6 flex flex-col gap-2">
      <Link href="/dashboard" className="text-small font-bold text-secondary px-3 hover:text-primary-text transition-colors">
        Front Desk
      </Link>

      {INERT_ROWS.map((label) => (
        <InertRow key={label} label={label} />
      ))}

      {inRoomStatusBoard ? (
        <div className="rounded-control bg-primary flex flex-col gap-1 p-1">
          <span className="px-2 py-1.5 text-tiny font-semibold text-white">In-House Management</span>
          <InertRow label="In-House Guest List" onDark />
          <span className="rounded-control px-2 py-1.5 text-tiny font-semibold bg-white/20 text-white ring-1 ring-white/40">
            Room Status Board
          </span>
        </div>
      ) : (
        <InertRow label="In-House Management" />
      )}

      {OPERATIONS_ROWS.map((label) => (
        <InertRow key={label} label={label} />
      ))}
    </aside>
  );
}

/** A row for a module that isn't built yet — visible (matching the documented architecture) but honestly non-interactive, not a dead link. */
function InertRow({ label, onDark = false }: { label: string; onDark?: boolean }) {
  return (
    <div
      title="Not built yet"
      className={`rounded-control px-3 py-2 text-tiny truncate ${
        onDark ? 'text-white/60' : 'border border-accent/30 text-secondary-light/70'
      }`}
    >
      {label}
    </div>
  );
}
