'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAlertsQuery } from '@/lib/alerts';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * The operations sidebar — a flat, single-level list, matching the
 * architecture map (`pms-frontend-structure-2.html`) exactly: every item
 * under OPERATIONS / MANAGEMENT / ADMIN is its own single row that links
 * straight to that item's own hub page. There is no second level of
 * nesting or expand-into-a-box behaviour anywhere in the sidebar itself —
 * a much earlier version of this file grew an elaborate expanding-box
 * mechanism (Front Desk's own Check-In/Check-Out/In-House Management
 * sub-groups shown IN the sidebar, Billing and Payments nesting six other
 * sections' worth of pages inside its own box, Management/Admin each
 * getting a "hub page" of their own) that does not exist in the reference
 * at all — pixel-checked against the actual screenshots, not assumed:
 * clicking "Reservations" or "Housekeeping" there never reveals a nested
 * list of their own sub-pages in the sidebar, it just highlights that one
 * row; the sub-page breakdown only ever appears as cards on the hub PAGE
 * itself (see `app/dashboard/page.tsx`'s own Check-In/Check-Out/In-House
 * Management `Section`s for where that breakdown actually belongs).
 *
 * Folio Transfer, Point of Sale, Shift Management, No-Show Handling,
 * Guest Reg. Card, and Comms Log used to live nested inside Billing and
 * Payments's own expanding box — the reference draws them as six
 * independent top-level Operations rows, peers of Billing and Payments,
 * not its children. Likewise Manager Dashboard, Overbooking Mgmt, Rate
 * Resolver, Guest Profiles & CRM, Revenue Management, Sales & Events,
 * Maintenance, Loyalty & Marketing, and Reports & Analytics are nine flat
 * peers under MANAGEMENT (not children of a "Management" hub page — no
 * such page exists in the reference; MANAGEMENT is a plain section label,
 * exactly like OPERATIONS), and Property Config / Integrations & APIs /
 * Security & Roles / System Admin / Enterprise-HQ are five flat peers
 * under ADMIN on the same basis.
 *
 * **Colour**: everything here sits on the page background, not inside a
 * `tone="secondary"` card, so it uses the PRIMARY family — sampled from the
 * reference, whose sidebar text is `#2d2300` (≈ `primary-dark`) and whose
 * active row label is `#cca000` (`primary`). See
 * `design-system/01-color.md` § "Which family on which surface".
 *
 * **Active state**: exactly one row is ever active, decided by each item's
 * own `isActive` predicate (covering its whole subtree of real sub-pages,
 * e.g. Front Desk covers `/dashboard/arrivals`, `/dashboard/check-in`, …)
 * rather than the nav comparing `pathname === href` — two entries pointing
 * at the same route both matching was a real, confirmed bug from the old
 * nested version.
 *
 * **Layout**: every row is `shrink-0`. Flex children shrink by default, so
 * once the list outgrew the viewport the rows compressed into each other
 * instead of the column scrolling.
 */
interface SidebarItem {
  label: string;
  href?: string;
  /** Defaults to an exact path match; override to cover a subtree (e.g. `/dashboard/check-in/[id]`). */
  isActive?: (pathname: string) => boolean;
}

const leaf = (item: SidebarItem): SidebarItem => item;

/**
 * OPERATIONS — ref p2's own sidebar, in that exact order. Front Desk's own
 * Check-In/Check-Out/In-House Management breakdown, and Reservations'/
 * Housekeeping's own sub-pages, are NOT repeated here — they're reachable
 * only via cards on each section's own hub page, matching the reference's
 * own single-level sidebar exactly.
 */
const OPERATIONS_ITEMS: SidebarItem[] = [
  leaf({ label: 'Front Desk', href: '/dashboard', isActive: (p) => p === '/dashboard' || ['/dashboard/arrivals', '/dashboard/departures', '/dashboard/check-in', '/dashboard/check-out', '/dashboard/walk-in-booking', '/dashboard/in-house-guest-list', '/dashboard/room-status-board'].some((prefix) => p.startsWith(prefix)) }),
  leaf({ label: 'Reservations', href: '/dashboard/reservations', isActive: (p) => p.startsWith('/dashboard/reservations') && !p.startsWith('/dashboard/reservations/rate-plans') }),
  leaf({ label: 'Housekeeping', href: '/dashboard/housekeeping' }),
  leaf({ label: 'Billing & Payments', href: '/dashboard/billing', isActive: (p) => p.startsWith('/dashboard/billing') || p.startsWith('/dashboard/split-billing') || p.startsWith('/dashboard/night-audit') }),
  leaf({ label: 'Folio Transfer', href: '/dashboard/folio-transfer' }),
  leaf({ label: 'Point of Sale', href: '/dashboard/pos' }),
  leaf({ label: 'Shift Management', href: '/dashboard/shifts' }),
  leaf({ label: 'No-Show Handling', href: '/dashboard/no-shows' }),
  leaf({ label: 'Guest Reg. Card', href: '/dashboard/registration-cards' }),
  leaf({ label: 'Comms Log', href: '/dashboard/comms-log' }),
];

/** MANAGEMENT — ref p10's own sidebar, in that exact order. Nine flat peers, no "Management" hub page. */
const MANAGEMENT_ITEMS: SidebarItem[] = [
  leaf({ label: 'Manager Dashboard', href: '/dashboard/manager' }),
  leaf({ label: 'Overbooking Mgmt', href: '/dashboard/overbooking' }),
  leaf({ label: 'Rate Resolver', href: '/dashboard/reservations/rate-plans', isActive: (p) => p.startsWith('/dashboard/reservations/rate-plans') }),
  leaf({ label: 'Guest Profiles & CRM', href: '/dashboard/guests' }),
  leaf({ label: 'Revenue Management', href: '/dashboard/revenue' }),
  leaf({ label: 'Sales & Events', href: '/dashboard/sales-events' }),
  leaf({ label: 'Maintenance', href: '/dashboard/maintenance' }),
  leaf({ label: 'Loyalty & Marketing', href: '/dashboard/loyalty' }),
  leaf({ label: 'Reports & Analytics', href: '/dashboard/reports' }),
];

/** ADMIN — ref p22's own sidebar, in that exact order. Five flat peers, no "Admin" hub page. */
const ADMIN_ITEMS: SidebarItem[] = [
  leaf({ label: 'Property Config', href: '/dashboard/property-config' }),
  leaf({ label: 'Integrations & APIs', href: '/dashboard/integrations' }),
  leaf({ label: 'Security & Roles', href: '/dashboard/security' }),
  leaf({ label: 'System Admin', href: '/dashboard/system-admin' }),
  leaf({ label: 'Enterprise / HQ', href: '/dashboard/hq' }),
];

function itemIsActive(item: SidebarItem, pathname: string): boolean {
  if (!item.href) return false;
  return item.isActive ? item.isActive(pathname) : pathname === item.href;
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
        {OPERATIONS_ITEMS.map((item) => (
          <SidebarLink key={item.label} item={item} pathname={pathname} />
        ))}

        <SidebarGroupLabel>Management</SidebarGroupLabel>
        {MANAGEMENT_ITEMS.map((item) => (
          <SidebarLink key={item.label} item={item} pathname={pathname} />
        ))}

        <SidebarGroupLabel>Admin</SidebarGroupLabel>
        {ADMIN_ITEMS.map((item) => (
          <SidebarLink key={item.label} item={item} pathname={pathname} />
        ))}
      </aside>
    </>
  );
}

/**
 * "OPERATIONS" / "MANAGEMENT" / "ADMIN" — the architecture map's own
 * top-level grouping. Plain, non-interactive small-caps label — never a
 * link, matching `Section.tsx`'s own established style exactly and the
 * reference's own breadcrumb, where the group segment is likewise always
 * plain text, never clickable (see `layout.tsx`).
 */
function SidebarGroupLabel({ children }: { children: string }) {
  return <h2 className="shrink-0 mt-2 first:mt-0 px-1 text-tiny font-bold uppercase tracking-wide text-primary-dark/50 whitespace-nowrap">{children}</h2>;
}

/**
 * "Alerts" (missed check-ins, overdue checkouts, overdue balances — see
 * `AlertsService`, ported from the in-house PMS's own alerts design) is a
 * Roomick-specific addition with no equivalent row in the reference — kept
 * because it's real, live, working functionality, not a mockup gap, styled
 * identically to a collapsed section row at rest, `bg-primary`-filled when
 * it's the open page, plus a red count badge, live-polled every 60s via
 * `useAlertsQuery`.
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
 * One flat sidebar row — a section header (Front Desk, Reservations, …) or
 * a Management/Admin item. Plain bordered pill at rest; solid `bg-primary`
 * fill when this item's own subtree is the open page. A row with no `href`
 * (none currently — every item above has a real hub page) renders as an
 * inert, non-interactive pill instead of a dead link.
 */
function SidebarLink({ item, pathname }: { item: SidebarItem; pathname: string }) {
  if (!item.href) return <InertRow label={item.label} />;
  const active = itemIsActive(item, pathname);
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={`shrink-0 rounded-control border px-3 py-2 text-tiny transition-colors ${
        active
          ? 'bg-primary border-primary text-white font-semibold'
          : 'border-primary/30 text-primary-dark font-normal hover:bg-primary-light/40'
      }`}
    >
      {item.label}
    </Link>
  );
}

function InertRow({ label }: { label: string }) {
  return (
    <div title="Not built yet" className="shrink-0 rounded-control border border-primary/20 px-3 py-2 text-tiny text-primary-dark/45 truncate">
      {label}
    </div>
  );
}
