'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The operations sidebar.
 *
 * **Colour**: everything here sits on the page background, not inside a
 * `tone="secondary"` card, so it uses the PRIMARY family — sampled from the
 * reference, whose sidebar text is `#2d2300` (≈ `primary-dark`) and whose
 * active group label is `#cca000` (`primary`). Lavender `secondary-light`
 * belongs to text *inside* secondary-toned cards only. See
 * `design-system/01-color.md` § "Which family on which surface".
 *
 * **Active state**: exactly one row is ever active. Each child owns an
 * `isActive` predicate rather than the nav comparing `pathname === href`,
 * because two entries pointing at the same route both matched and both lit
 * up — ambiguous and wrong. Every child now has its own destination.
 *
 * **Selected-pill styling** (inside `GroupRow`) is pixel-sampled off the
 * reference, not guessed: every child pill has a border and a fill at rest,
 * both of which merely strengthen when selected (border ~35%→70% white,
 * fill ~20%→50% `primary-light` over the group's gold), and only the
 * selected pill is bold. See that component's own comment for the exact
 * measurements.
 *
 * **Layout**: every row is `shrink-0`. Flex children shrink by default, so
 * once the list outgrew the viewport the rows compressed into each other
 * instead of the column scrolling.
 */
interface SidebarChild {
  label: string;
  href?: string;
  /** Defaults to an exact path match; override when a child owns a subtree (e.g. `/check-in/[id]`). */
  isActive?: (pathname: string) => boolean;
}
interface SidebarGroup {
  label: string;
  children: SidebarChild[];
}

const GROUPS: SidebarGroup[] = [
  {
    label: 'Check-In',
    children: [
      { label: 'Arrivals Dashboard', href: '/dashboard/arrivals' },
      { label: 'Check-In Flow', href: '/dashboard/check-in', isActive: (p) => p.startsWith('/dashboard/check-in') },
      { label: 'Walk-In Booking', href: '/dashboard/walk-in-booking' },
    ],
  },
  {
    label: 'Check-Out',
    children: [
      { label: 'Departures Dashboard', href: '/dashboard/departures' },
      { label: 'Check-Out Flow', href: '/dashboard/check-out', isActive: (p) => p.startsWith('/dashboard/check-out') },
      { label: 'Room Change' },
    ],
  },
  {
    label: 'In-House Management',
    children: [
      { label: 'In-House Guest List', href: '/dashboard/in-house-guest-list' },
      { label: 'Room Status Board', href: '/dashboard/room-status-board' },
    ],
  },
  {
    label: 'Billing and Payments',
    children: [
      { label: 'Guest Folio', href: '/dashboard/billing', isActive: (p) => p.startsWith('/dashboard/billing') },
      { label: 'Split Billing', href: '/dashboard/split-billing' },
      { label: 'Night Audit', href: '/dashboard/night-audit' },
      { label: 'Refunds and Corrections' },
    ],
  },
];

/** Modules with no backend yet — visible so the documented architecture still reads, but honestly non-interactive. */
const INERT_ROWS = [
  'Reservations',
  'Housekeeping',
  'Folio Transfer',
  'Point of Sale',
  'Shift Management',
  'No-Show Handling',
  'Guest Registration Card',
  'Comms Log',
];

function childIsActive(child: SidebarChild, pathname: string): boolean {
  if (!child.href) return false;
  return child.isActive ? child.isActive(pathname) : pathname === child.href;
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 overflow-y-auto border-r border-primary/20 px-4 py-6 flex flex-col gap-2">
      <Link
        href="/dashboard"
        className="shrink-0 text-small font-bold text-primary-dark px-3 hover:text-primary-text transition-colors"
      >
        Front Desk
      </Link>

      {GROUPS.map((group) => (
        <GroupRow key={group.label} group={group} pathname={pathname} />
      ))}

      {INERT_ROWS.map((label) => (
        <InertRow key={label} label={label} />
      ))}
    </aside>
  );
}

/** Expanded (children visible) while a page inside it is open; a single collapsed link otherwise. */
function GroupRow({ group, pathname }: { group: SidebarGroup; pathname: string }) {
  const expanded = group.children.some((c) => childIsActive(c, pathname));

  if (!expanded) {
    const firstReal = group.children.find((c) => c.href)?.href;
    // A collapsed group is still a real link to its first child — otherwise
    // a group you aren't already inside is a dead end.
    if (!firstReal) return <InertRow label={group.label} />;
    return (
      <Link
        href={firstReal}
        className="shrink-0 rounded-control px-3 py-2 text-tiny font-semibold text-primary-dark border border-primary/30 hover:bg-primary-light/40 transition-colors"
      >
        {group.label}
      </Link>
    );
  }

  return (
    <div className="shrink-0 rounded-control bg-primary flex flex-col gap-1 p-1">
      <span className="px-2 py-1.5 text-tiny font-semibold text-white">{group.label}</span>
      {group.children.map((child) =>
        child.href ? (
          <Link
            key={child.label}
            href={child.href}
            aria-current={childIsActive(child, pathname) ? 'page' : undefined}
            // Every child pill carries its own border and its own fill —
            // both are always present, only their strength changes. Pixel-
            // sampled directly off the reference (p11): the fill is
            // ~primary-light at 19% opacity over the group's `bg-primary`
            // at rest, ~48% when selected — a genuinely lighter shade of
            // the same gold, NOT a white wash over it (the earlier
            // `bg-white/25 ring-1` version was a guess, not measured). Text
            // stays pure white either way — the whitest pixel inside both
            // "Arrivals Dashboard" (selected) and "Check-In Flow"
            // (unselected) sampled identically at #ffffff. The only other
            // difference is weight: `font-semibold` only on the selected
            // row, `font-normal` otherwise — the reference never bolds a
            // child that isn't the current page.
            className={`rounded-control border px-2 py-1.5 text-tiny text-white transition-colors ${
              childIsActive(child, pathname)
                ? 'border-white/70 bg-primary-light/50 font-semibold'
                : 'border-white/35 bg-primary-light/20 font-normal hover:border-white/55 hover:bg-primary-light/30'
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

function InertRow({ label, onDark = false }: { label: string; onDark?: boolean }) {
  return (
    <div
      title="Not built yet"
      className={`shrink-0 rounded-control border px-3 py-2 text-tiny truncate ${
        // An inert row inside an expanded group (e.g. "Room Change" sitting
        // among real Check-Out pills) still gets the same bordered-pill
        // shape as its siblings — a bare unbordered label there read as if
        // it had fallen out of the list, when every real pill next to it is
        // bordered. The border is just dimmer, since nothing is selectable.
        onDark ? 'border-white/20 text-white/55' : 'border-primary/20 text-primary-dark/45'
      }`}
    >
      {label}
    </div>
  );
}
