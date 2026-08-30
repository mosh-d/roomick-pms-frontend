'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAlertsQuery } from '@/lib/alerts';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * The operations sidebar.
 *
 * **Structure — two real levels, not one hardcoded specially.** Front Desk,
 * Reservations, Housekeeping, and Billing and Payments are all the SAME
 * kind of thing: a top-level section that collapses to a single row when
 * you're elsewhere, and expands to a bordered box (its own label + its own
 * children, indented) when a page inside it is open. An earlier version
 * hardcoded Front Desk's box directly in `Sidebar()`'s own JSX while the
 * other three went through `GroupRow`'s solid-gold "expanded group"
 * rendering instead — two genuinely different components for what the
 * reference draws as the same pattern, and Front Desk never collapsed at
 * all even when you'd navigated somewhere else entirely. `TopLevelSection`
 * + `TopLevelSectionRow` below is the one shared implementation now; only
 * Front Desk still has a SECOND level of nesting (Check-In / Check-Out /
 * In-House Management, each its own `GroupRow`), because that's genuinely
 * how the reference organizes it — Reservations/Housekeeping/Billing's own
 * pages sit directly inside their section box, one level, no sub-groups.
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
 * **Selected-pill styling** (inside `GroupRow`, Front Desk's own nested
 * groups) is pixel-sampled off the reference, not guessed: every child pill
 * has a border and a fill at rest, both of which merely strengthen when
 * selected (border ~35%→70% white, fill ~20%→50% `primary-light` over the
 * group's gold), and only the selected pill is bold. See that component's
 * own comment for the exact measurements. A top-level section's own DIRECT
 * page children (`LeafPill`) are simpler — plain bordered pill at rest,
 * solid `bg-primary` fill only when that exact page is open — since they
 * sit straight on the section box's pale background, not on a second gold
 * layer the way Front Desk's nested pills do.
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

/**
 * Front Desk's own second level of nesting — Check-In / Check-Out /
 * In-House Management, each independently collapsing to a link or
 * expanding to a solid-gold pill list depending on whether one of ITS OWN
 * children is open. Nothing else in the sidebar nests this deep; every
 * other section's children are direct pages.
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

type SectionItem = { kind: 'leaf'; child: SidebarChild } | { kind: 'group'; group: SidebarGroup };

interface TopLevelSection {
  label: string;
  /**
   * The section's own hub/first-page link — collapsed-row target AND the
   * expanded box's own label link. Undefined only for a section with
   * genuinely zero real pages under it yet (`ADMIN_SECTION` today) — it
   * renders as a plain inert label instead of a dead link, and starts
   * linking the moment its own first real child page exists, the same way
   * `BILLING_SECTION`'s own "no dedicated hub, use the first real child"
   * precedent already works.
   */
  href?: string;
  items: SectionItem[];
}

const leaf = (child: SidebarChild): SectionItem => ({ kind: 'leaf', child });

const FRONT_DESK_SECTION: TopLevelSection = {
  label: 'Front Desk',
  href: '/dashboard',
  items: FRONT_DESK_GROUPS.map((group) => ({ kind: 'group', group })),
};

/**
 * Overbooking Management and Rate Plan Management ("Rate Resolver" in the
 * architecture map's own naming) both moved out of here into
 * `MANAGEMENT_SECTION` — the architecture map (`pms-frontend-structure-2
 * .html`'s own Operations/Management/Admin sidebar) places both under
 * Management, not Operations, and this section previously had them here
 * only because no Management section existed yet to hold them.
 */
const RESERVATIONS_SECTION: TopLevelSection = {
  label: 'Reservations',
  href: '/dashboard/reservations',
  items: [
    leaf({ label: 'Availability Calendar', href: '/dashboard/reservations/availability-calendar' }),
    leaf({ label: 'Create Reservation', href: '/dashboard/reservations/create' }),
    leaf({ label: 'Modify Reservation', href: '/dashboard/reservations/modify' }),
    leaf({ label: 'Cancel Reservation', href: '/dashboard/reservations/cancel' }),
    leaf({ label: 'Waitlist Management', href: '/dashboard/reservations/waitlist' }),
  ],
};

const HOUSEKEEPING_SECTION: TopLevelSection = {
  label: 'Housekeeping',
  href: '/dashboard/housekeeping',
  items: [
    leaf({ label: 'Task Board', href: '/dashboard/housekeeping/task-board' }),
    leaf({ label: 'Staff Assignment', href: '/dashboard/housekeeping/staff-assignment' }),
    leaf({ label: 'Inspection Workflow', href: '/dashboard/housekeeping/inspection-workflow' }),
    leaf({ label: 'Room Blocking / OOO', href: '/dashboard/housekeeping/room-blocking' }),
  ],
};

/**
 * Ref p9's own sidebar: everything under "Billing and Payments" is
 * Guest Folio, Folio Transfer, Point of Sale, Shift Management, No-Show
 * Handling, Guest Registration Card, Comms Log — this list, in that
 * order, `Split Billing`/`Night Audit`/`Refunds and Corrections` are
 * Roomick's own additions beyond the reference. A row with no `href` is a
 * plain inert pill (see `LeafPill`) — moved to a real one the moment its
 * own page exists, no other change needed. Previously these lived as a
 * SEPARATE flat top-level list (`INERT_TOP_LEVEL`) rendered below the real
 * sections, which didn't match the reference's own nesting at all — moved
 * here, matching it exactly, when No-Show Handling's own page made the
 * mismatch worth fixing properly rather than adding a 7th special case.
 */
const BILLING_SECTION: TopLevelSection = {
  label: 'Billing and Payments',
  // No dedicated hub page — Guest Folio (its first, most useful page) is
  // the collapsed-row target and the expanded box's own label link, same
  // role a real hub plays for the other three sections.
  href: '/dashboard/billing',
  items: [
    leaf({ label: 'Guest Folio', href: '/dashboard/billing', isActive: (p) => p.startsWith('/dashboard/billing') }),
    leaf({ label: 'Folio Transfer' }),
    leaf({ label: 'Split Billing', href: '/dashboard/split-billing' }),
    leaf({ label: 'Point of Sale' }),
    leaf({ label: 'Shift Management', href: '/dashboard/shifts' }),
    leaf({ label: 'Night Audit', href: '/dashboard/night-audit' }),
    leaf({ label: 'No-Show Handling', href: '/dashboard/no-shows' }),
    leaf({ label: 'Guest Registration Card', href: '/dashboard/registration-cards' }),
    leaf({ label: 'Comms Log', href: '/dashboard/comms-log' }),
    leaf({ label: 'Refunds and Corrections' }),
  ],
};

/**
 * Reports & Analytics is a nested GROUP inside `MANAGEMENT_SECTION` below,
 * not its own top-level section — the architecture map places it under
 * Management, peer to Revenue Management/Guest CRM/etc., not standing
 * alone. Only Operational Reports is built: Financial Reports (tax
 * summary, cash-flow waterfall) and the Custom Report Builder are the
 * reference's own later-phase scalability hooks (BI exports, scheduled
 * reports), explicitly beyond the Month 5 MVP deliverable line.
 */
const REPORTS_GROUP: SidebarGroup = {
  label: 'Reports & Analytics',
  children: [
    { label: 'Operational Reports', href: '/dashboard/reports' },
    { label: 'Financial Reports' },
    { label: 'Custom Report Builder' },
  ],
};

/**
 * `pms-frontend-structure-2.html`'s own architecture map — the
 * Operations/Management/Admin sidebar it draws — is the ground truth for
 * this section's membership and order, not a guess. Two real pages move
 * in from Reservations (Overbooking Management, and Rate Plan Management
 * renamed to the map's own "Rate Resolver" label — the underlying
 * `RateResolverService`/cascade pricing engine is exactly what that map
 * entry names, "the single source of truth for all rate calculations";
 * Rate Plan Management is the one real screen that configures it, so it's
 * the correct link, not a placeholder standing in for something separate).
 * Every other entry here is a real, named gap — not invented scope, the
 * map's own page ids (`page-manager`, `page-guestprofile`, `page-rms`,
 * `page-events`, `page-maintenance`, `page-loyalty`) each have a full
 * endpoint/UI spec already written, just never built.
 */
const MANAGEMENT_SECTION: TopLevelSection = {
  label: 'Management',
  href: '/dashboard/manager',
  items: [
    leaf({ label: 'Manager Dashboard', href: '/dashboard/manager' }),
    leaf({ label: 'Overbooking Mgmt', href: '/dashboard/overbooking' }),
    leaf({ label: 'Rate Resolver', href: '/dashboard/reservations/rate-plans' }),
    leaf({ label: 'Guest Profiles & CRM' }),
    leaf({ label: 'Revenue Management' }),
    leaf({ label: 'Sales & Events' }),
    leaf({ label: 'Maintenance' }),
    leaf({ label: 'Loyalty & Marketing' }),
    { kind: 'group', group: REPORTS_GROUP },
  ],
};

/**
 * Security & Roles and Property Config are now real — the rest are still
 * genuinely unbuilt, confirmed directly (no integrations page, no backup/
 * system-health admin screen, no cross-branch HQ view) rather than
 * assumed. `href` still points at Security & Roles, the first of the two
 * to land — no page here is more "central" than the other the way Manager
 * Dashboard was for Management, so there's no strong reason to move it.
 */
const ADMIN_SECTION: TopLevelSection = {
  label: 'Admin',
  href: '/dashboard/security',
  items: [
    leaf({ label: 'Property Config', href: '/dashboard/property-config' }),
    leaf({ label: 'Integrations & APIs' }),
    leaf({ label: 'Security & Roles', href: '/dashboard/security' }),
    leaf({ label: 'System Admin' }),
    leaf({ label: 'Enterprise / HQ' }),
  ],
};

const OPERATIONS_SECTIONS: TopLevelSection[] = [RESERVATIONS_SECTION, HOUSEKEEPING_SECTION, BILLING_SECTION];

function childIsActive(child: SidebarChild, pathname: string): boolean {
  if (!child.href) return false;
  return child.isActive ? child.isActive(pathname) : pathname === child.href;
}

function sectionItemIsActive(item: SectionItem, pathname: string): boolean {
  return item.kind === 'leaf' ? childIsActive(item.child, pathname) : item.group.children.some((c) => childIsActive(c, pathname));
}

function sectionIsActive(section: TopLevelSection, pathname: string): boolean {
  return pathname === section.href || section.items.some((item) => sectionItemIsActive(item, pathname));
}

/**
 * Below the `md` breakpoint this is an off-canvas drawer (`fixed`,
 * `-translate-x-full` at rest, a `md:hidden` backdrop dismisses it) rather
 * than the always-visible rail it is at `md` and up — found live, not by
 * inspection: at a 375px viewport the old unconditional `w-60` rail alone
 * left barely 135px for `main`, squeezing every page's own content into an
 * unusable sliver. `layout.tsx` owns the open/closed state (it also owns
 * the header's own hamburger toggle); this component closes itself on its
 * own pathname change so tapping a link dismisses the drawer instead of
 * leaving it open over the page the user just navigated to.
 */
export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();

  useEffect(() => {
    onClose();
    // Only the pathname changing should close the drawer — including
    // `onClose` here would also fire this on every parent re-render that
    // creates a new function identity, which defeats the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {mobileOpen ? (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      ) : null}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-60 shrink-0 overflow-y-auto border-r border-primary/20 bg-white px-4 py-6 flex flex-col gap-2 print:hidden transition-transform duration-200 md:static md:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarGroupLabel>Operations</SidebarGroupLabel>
        <AlertsLink pathname={pathname} />
        <TopLevelSectionRow section={FRONT_DESK_SECTION} pathname={pathname} />
        {OPERATIONS_SECTIONS.map((section) => (
          <TopLevelSectionRow key={section.label} section={section} pathname={pathname} />
        ))}

        <SidebarGroupLabel>Management</SidebarGroupLabel>
        <TopLevelSectionRow section={MANAGEMENT_SECTION} pathname={pathname} />

        <SidebarGroupLabel>Admin</SidebarGroupLabel>
        <TopLevelSectionRow section={ADMIN_SECTION} pathname={pathname} />
      </aside>
    </>
  );
}

/**
 * "OPERATIONS" / "MANAGEMENT" / "ADMIN" — the architecture map's own
 * top-level grouping, matching `Section.tsx`'s own established small-caps
 * label style exactly (`text-tiny font-bold uppercase tracking-wide
 * text-primary-dark/50`) rather than inventing a second "section header"
 * look for what's visually the same idea (a quiet label introducing a
 * cluster of related content) in a different part of the page.
 */
function SidebarGroupLabel({ children }: { children: string }) {
  return <h2 className="shrink-0 mt-2 first:mt-0 px-1 text-tiny font-bold uppercase tracking-wide text-primary-dark/50 whitespace-nowrap">{children}</h2>;
}

/**
 * "Alerts" (missed check-ins, overdue checkouts, overdue balances — see
 * `AlertsService`, ported from the in-house PMS's own alerts design) has
 * exactly one destination page, not a group of children, so it doesn't go
 * through `TopLevelSectionRow`'s expand-to-a-box machinery at all — that
 * machinery exists for sections with multiple child pages to reveal.
 * Styled identically to a collapsed section row at rest, `bg-primary`-
 * filled when it's the open page (matching `LeafPill`'s own "you're on
 * this single page" treatment), plus a red count badge, live-polled every
 * 60s via `useAlertsQuery` — the in-house reference pushes this over a
 * websocket; Roomick has no such infrastructure yet, so polling is the
 * honest equivalent, not a placeholder for it.
 */
function AlertsLink({ pathname }: { pathname: string }) {
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const alertsQuery = useAlertsQuery(activeBranchId, { accessToken: accessToken ?? undefined, tenantId: user?.tenantId });
  const total = alertsQuery.data?.total ?? 0;
  const active = pathname.startsWith('/dashboard/alerts');

  return (
    <Link
      href="/dashboard/alerts"
      aria-current={active ? 'page' : undefined}
      className={`shrink-0 flex items-center justify-between gap-2 rounded-control px-3 py-2 text-tiny font-semibold border transition-colors ${
        active ? 'bg-primary border-primary text-white' : 'text-primary-dark border-primary/30 hover:bg-primary-light/40'
      }`}
    >
      Alerts
      {total > 0 ? (
        <span className="inline-flex min-w-5 items-center justify-center rounded-pill bg-red-600 px-1.5 py-0.5 text-tiny font-bold leading-none text-white">
          {total > 99 ? '99+' : total}
        </span>
      ) : null}
    </Link>
  );
}

/**
 * Collapses to a single bordered link when nothing inside the section is
 * open — same look every collapsed `GroupRow` already used, so Front Desk
 * collapsing away when you're in Reservations reads identically to
 * Reservations collapsing away when you're in Housekeeping, not as a
 * special case. Expands to a bordered, `bg-primary/5`-tinted box (the same
 * 5% rest-state convention `CARD_TONE_CLASSES` uses — see
 * `design-system/01-color.md` § "Card tone tints") containing the
 * section's own label and its indented children.
 */
function TopLevelSectionRow({ section, pathname }: { section: TopLevelSection; pathname: string }) {
  const active = sectionIsActive(section, pathname);

  if (!active) {
    // No real page under this section yet (`ADMIN_SECTION` today) — a
    // plain inert row, same treatment `InertRow` already gives any single
    // not-built-yet leaf, rather than a `<Link>` with nowhere real to go.
    if (!section.href) return <InertRow label={section.label} />;
    return (
      <Link
        href={section.href}
        className="shrink-0 rounded-control px-3 py-2 text-tiny font-semibold text-primary-dark border border-primary/30 hover:bg-primary-light/40 transition-colors"
      >
        {section.label}
      </Link>
    );
  }

  return (
    <div className="shrink-0 rounded-card border border-primary/30 bg-primary/5 p-3 flex flex-col gap-2">
      {section.href ? (
        <Link href={section.href} className="shrink-0 text-small font-bold text-primary-dark hover:text-primary-text transition-colors">
          {section.label}
        </Link>
      ) : (
        <span className="shrink-0 text-small font-bold text-primary-dark">{section.label}</span>
      )}
      <div className="flex flex-col gap-2 pl-3">
        {section.items.map((item) =>
          item.kind === 'leaf' ? (
            <LeafPill key={item.child.label} child={item.child} pathname={pathname} />
          ) : (
            <GroupRow key={item.group.label} group={item.group} pathname={pathname} />
          ),
        )}
      </div>
    </div>
  );
}

/**
 * One of a top-level section's own direct pages (Reservations' "Create
 * Reservation", Housekeeping's "Task Board", ...). Plain bordered pill at
 * rest; solid `bg-primary` fill only when it's the exact open page — it
 * sits straight on the section box's pale background, so unlike a nested
 * `GroupRow` pill it doesn't need a lighter-gold-over-gold blend to read
 * as "selected", a flat gold fill against the pale box already contrasts.
 */
function LeafPill({ child, pathname }: { child: SidebarChild; pathname: string }) {
  if (!child.href) return <InertRow label={child.label} />;
  const active = childIsActive(child, pathname);
  return (
    <Link
      href={child.href}
      aria-current={active ? 'page' : undefined}
      className={`shrink-0 rounded-control border px-3 py-2 text-tiny transition-colors ${
        active
          ? 'bg-primary border-primary text-white font-semibold'
          : 'border-primary/30 text-primary-dark font-normal hover:bg-primary-light/40'
      }`}
    >
      {child.label}
    </Link>
  );
}

/** Front Desk's own nested groups only (Check-In / Check-Out / In-House Management) — expanded (children visible, solid gold) while a page inside it is open; a single collapsed link otherwise. */
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
