'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The Front Desk sidebar (Roomick-UI.pdf pages 10, 14, 15, 18, 19). Reuses
 * `WizardShell.tsx`'s own row/active-state classes rather than a second,
 * separately-tuned copy — same shared-styling discipline that page's own
 * header comments establish for this codebase.
 *
 * A group only expands to show its children while a page inside it is
 * actually open (`activeWhen`) — matching `WizardShell`'s own "only the
 * active section auto-expands" rule (driven by the current route, not a
 * static default) — collapsed to a single row everywhere else, including
 * on the hub page itself, matching what both reference pages (10 and 19)
 * actually show.
 *
 * "Check-In Flow" and "Check-Out Flow" point at the same destination as
 * their sibling "Dashboard" entries (Arrivals/Departures) — there's no
 * standalone flow entry point independent of a specific reservation row;
 * entering either always starts from that dashboard's per-row button.
 * "Room Change" and everything under Operations stays inert — no backend
 * exists for any of it yet (see PHASE_NOTES.md's "backend build order").
 *
 * A collapsed group's own label is ALSO a real link, to its first child's
 * route — without this, a group you're not already inside of would be a
 * dead end reachable only by going back through the hub first, which is a
 * worse, more confusing sidebar than not expanding at all. Caught live: a
 * first pass left collapsed groups fully inert, discovered while testing
 * cross-group navigation (Arrivals → Room Status Board) with no path back
 * except the hub card.
 */
interface SidebarChild {
  label: string;
  href?: string;
}
interface SidebarGroup {
  label: string;
  children: SidebarChild[];
  activeWhen: (pathname: string) => boolean;
}

const GROUPS: SidebarGroup[] = [
  {
    label: 'Check-In',
    children: [
      { label: 'Arrivals Dashboard', href: '/dashboard/arrivals' },
      { label: 'Check-In Flow', href: '/dashboard/arrivals' },
      { label: 'Walk-In Booking', href: '/dashboard/walk-in-booking' },
    ],
    activeWhen: (p) => p.startsWith('/dashboard/arrivals') || p.startsWith('/dashboard/check-in') || p.startsWith('/dashboard/walk-in-booking'),
  },
  {
    label: 'Check-Out',
    children: [
      { label: 'Departures Dashboard', href: '/dashboard/departures' },
      { label: 'Check-Out Flow', href: '/dashboard/departures' },
      { label: 'Room Change' },
    ],
    activeWhen: (p) => p.startsWith('/dashboard/departures'),
  },
  {
    label: 'In-House Management',
    children: [
      { label: 'In-House Guest List', href: '/dashboard/in-house-guest-list' },
      { label: 'Room Status Board', href: '/dashboard/room-status-board' },
    ],
    activeWhen: (p) => p.startsWith('/dashboard/in-house-guest-list') || p.startsWith('/dashboard/room-status-board'),
  },
];

/** Groups that sit below the three Front Desk ones — same expand-on-active rule. */
const OPERATIONS_GROUPS: SidebarGroup[] = [
  {
    label: 'Billing and Payments',
    children: [
      { label: 'Guest Folio', href: '/dashboard/billing' },
      { label: 'Split Billing' },
      { label: 'Night Audit' },
      { label: 'Refunds and Corrections' },
    ],
    activeWhen: (p) => p.startsWith('/dashboard/billing'),
  },
];

const INERT_OPERATIONS_ROWS = [
  'Reservations',
  'Housekeeping',
  'Folio Transfer',
  'Point of Sale',
  'Shift Management',
  'No-Show Handling',
  'Guest Registration Card',
  'Comms Log',
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 overflow-y-auto border-r border-accent/20 px-4 py-6 flex flex-col gap-2">
      <Link href="/dashboard" className="text-small font-bold text-secondary px-3 hover:text-primary-text transition-colors">
        Front Desk
      </Link>

      {GROUPS.map((group) => (
        <GroupRow key={group.label} group={group} pathname={pathname} />
      ))}

      {OPERATIONS_GROUPS.map((group) => (
        <GroupRow key={group.label} group={group} pathname={pathname} />
      ))}

      {INERT_OPERATIONS_ROWS.map((label) => (
        <InertRow key={label} label={label} />
      ))}
    </aside>
  );
}

/** One sidebar group: expanded (with its children) while a page inside it is open, a single collapsed link otherwise. */
function GroupRow({ group, pathname }: { group: SidebarGroup; pathname: string }) {
  if (!group.activeWhen(pathname)) {
    return <CollapsedGroupRow label={group.label} href={group.children.find((c) => c.href)?.href} />;
  }
  return (
    <div className="rounded-control bg-primary flex flex-col gap-1 p-1">
      <span className="px-2 py-1.5 text-tiny font-semibold text-white">{group.label}</span>
      {group.children.map((child) =>
        child.href ? (
          <Link
            key={child.label}
            href={child.href}
            className={`rounded-control px-2 py-1.5 text-tiny font-semibold transition-colors ${
              pathname === child.href ? 'bg-white/20 text-white ring-1 ring-white/40' : 'text-white/80 hover:bg-white/10'
            }`}
          >
            {child.label}
          </Link>
        ) : (
          <InertRow key={child.label} label={child.label} onDark />
        ),
      )}
    </div>
  );
}

/** A collapsed group's own row — a real link to its first real child when one exists (see this file's header comment on why), otherwise a plain inert row (e.g. no group has any built page at all yet). */
function CollapsedGroupRow({ label, href }: { label: string; href?: string }) {
  if (!href) return <InertRow label={label} />;
  return (
    <Link
      href={href}
      className="rounded-control px-3 py-2 text-tiny font-semibold text-secondary border border-accent/30 hover:bg-accent/10 transition-colors"
    >
      {label}
    </Link>
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
