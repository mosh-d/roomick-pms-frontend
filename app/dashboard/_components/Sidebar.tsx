'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * The operations sidebar.
 *
 * **Structure**: "Front Desk" owns a bordered box containing exactly
 * Check-In / Check-Out / In-House Management — its own indented children.
 * Reservations, Housekeeping, Billing and Payments, and the rest sit
 * OUTSIDE that box as separate top-level rows, matching the reference
 * exactly (its border closes right after In-House Management, and
 * Reservations starts its own separately-bordered box below). An earlier
 * version flattened all four groups into one list with no wrapper at all —
 * missing the box entirely, not just under-styling it.
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
  /**
   * A group with its own overview/hub page (only Reservations, so far —
   * mirrors the Front Desk hub pattern at `/dashboard`) sets this so the
   * group's own label becomes a link back to it, collapsed or expanded.
   * Without it, the label is plain text when expanded, and the collapsed
   * link falls back to the first child with an href (Billing and
   * Payments has no hub of its own — its collapsed click goes straight to
   * Guest Folio, its most useful default).
   */
  href?: string;
}

/**
 * "Front Desk" isn't just the sidebar's top link — in the reference it OWNS
 * a bordered section containing exactly Check-In / Check-Out / In-House
 * Management, and that box closes before Reservations, Housekeeping,
 * Billing and Payments, etc. begin as their own, separately-bordered
 * top-level rows. An earlier version of this file flattened all four
 * groups (including Billing and Payments) into one list with no shared
 * wrapper — structurally wrong, not just a missing border.
 */
const FRONT_DESK_GROUPS: SidebarGroup[] = [
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
];

const RESERVATIONS_GROUP: SidebarGroup = {
  label: 'Reservations',
  href: '/dashboard/reservations',
  children: [
    { label: 'Availability Calendar', href: '/dashboard/reservations/availability-calendar' },
    { label: 'Create Reservation', href: '/dashboard/reservations/create' },
    { label: 'Modify Reservation', href: '/dashboard/reservations/modify' },
    { label: 'Cancel Reservation', href: '/dashboard/reservations/cancel' },
    { label: 'Waitlist Management', href: '/dashboard/reservations/waitlist' },
    { label: 'Rate Plan Management' },
  ],
};

const BILLING_GROUP: SidebarGroup = {
  label: 'Billing and Payments',
  children: [
    { label: 'Guest Folio', href: '/dashboard/billing', isActive: (p) => p.startsWith('/dashboard/billing') },
    { label: 'Split Billing', href: '/dashboard/split-billing' },
    { label: 'Night Audit', href: '/dashboard/night-audit' },
    { label: 'Refunds and Corrections' },
  ],
};

type TopLevelItem = { kind: 'group'; group: SidebarGroup } | { kind: 'inert'; label: string };

/**
 * Everything below the Front Desk box, in the reference's own order:
 * Reservations, Housekeeping, Billing and Payments, Folio Transfer, Point
 * of Sale, Shift Management, No-Show Handling, Guest Registration Card,
 * Comms Log. Billing and Payments is the one real, built group in this
 * list — it renders with `GroupRow`, same as the Front Desk groups do,
 * just outside that box rather than inside it. The rest have no backend
 * module yet (see PHASE_NOTES.md's build order) and render inert — visible
 * so the documented architecture still reads, but honestly non-interactive.
 */
const TOP_LEVEL: TopLevelItem[] = [
  { kind: 'group', group: RESERVATIONS_GROUP },
  { kind: 'inert', label: 'Housekeeping' },
  { kind: 'group', group: BILLING_GROUP },
  { kind: 'inert', label: 'Folio Transfer' },
  { kind: 'inert', label: 'Point of Sale' },
  { kind: 'inert', label: 'Shift Management' },
  { kind: 'inert', label: 'No-Show Handling' },
  { kind: 'inert', label: 'Guest Registration Card' },
  { kind: 'inert', label: 'Comms Log' },
];

function childIsActive(child: SidebarChild, pathname: string): boolean {
  if (!child.href) return false;
  return child.isActive ? child.isActive(pathname) : pathname === child.href;
}

export function Sidebar() {
  const pathname = usePathname();
  // Whether the current page is anywhere under Front Desk's own umbrella
  // (the hub itself, or one of its three groups' children) — the same
  // `childIsActive` test every `GroupRow` already uses, applied here since
  // the Front Desk box isn't a `SidebarGroup` and has no `GroupRow` of its
  // own to compute it for.
  const frontDeskActive =
    pathname === '/dashboard' || FRONT_DESK_GROUPS.some((group) => group.children.some((child) => childIsActive(child, pathname)));

  return (
    <aside className="w-60 shrink-0 overflow-y-auto border-r border-primary/20 px-4 py-6 flex flex-col gap-2">
      {/*
       * The Front Desk box. Border color is pixel-matched, not guessed:
       * the reference's box stroke (`#dbba46` over its `#fffaeb` fill)
       * solves to primary (`#CCA000`) at ~30% alpha over that fill — the
       * exact same `border-primary/30` this file already uses for a
       * collapsed group row, reused rather than a new one-off value.
       *
       * Fill is conditional: `bg-primary/10` while Front Desk is the
       * active section, transparent otherwise — the same 10%-opacity-at-
       * rest convention `CARD_TONE_CLASSES` already uses for a tinted
       * surface, so "this section is where you are" reads the same way a
       * `Card`'s own tone does, not a one-off invented for this box.
       */}
      <div className={`shrink-0 rounded-card border border-primary/30 p-3 flex flex-col gap-2 transition-colors ${frontDeskActive ? 'bg-primary/10' : ''}`}>
        <Link href="/dashboard" className="shrink-0 text-small font-bold text-primary-dark hover:text-primary-text transition-colors">
          Front Desk
        </Link>
        {/*
         * Indented one step relative to "Front Desk" above it. Pixel-
         * sampling the reference shows its own Check-In box left edge
         * flush with "Front Desk"'s text (x=108 vs x=105 — noise, not a
         * deliberate offset) — but told directly that "Front Desk" should
         * stay far left while its children read as indented, so this is a
         * deliberate improvement on the static mockup, not a reference
         * measurement. The user's own standing guidance is that the
         * mockups convey feel, not literal pixel law.
         */}
        <div className="flex flex-col gap-2 pl-3">
          {FRONT_DESK_GROUPS.map((group) => (
            <GroupRow key={group.label} group={group} pathname={pathname} />
          ))}
        </div>
      </div>

      {TOP_LEVEL.map((item) =>
        item.kind === 'group' ? (
          <GroupRow key={item.group.label} group={item.group} pathname={pathname} />
        ) : (
          <InertRow key={item.label} label={item.label} />
        ),
      )}
    </aside>
  );
}

/** Expanded (children visible) while a page inside it is open; a single collapsed link otherwise. */
function GroupRow({ group, pathname }: { group: SidebarGroup; pathname: string }) {
  const expanded = group.children.some((c) => childIsActive(c, pathname));

  if (!expanded) {
    // A group with its own hub (Reservations) collapses to a link there;
    // one without (Billing and Payments has none) falls back to its first
    // real child — either way, a collapsed group is never a dead end.
    const collapsedTarget = group.href ?? group.children.find((c) => c.href)?.href;
    if (!collapsedTarget) return <InertRow label={group.label} />;
    return (
      <Link
        href={collapsedTarget}
        className="shrink-0 rounded-control px-3 py-2 text-tiny font-semibold text-primary-dark border border-primary/30 hover:bg-primary-light/40 transition-colors"
      >
        {group.label}
      </Link>
    );
  }

  return (
    <div className="shrink-0 rounded-control bg-primary flex flex-col gap-1 p-1">
      {group.href ? (
        <Link href={group.href} className="px-2 py-1.5 text-tiny font-semibold text-white hover:underline">
          {group.label}
        </Link>
      ) : (
        <span className="px-2 py-1.5 text-tiny font-semibold text-white">{group.label}</span>
      )}
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
