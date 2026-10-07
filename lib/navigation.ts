/**
 * The dashboard's map: three groups (Operations / Management / Admin), the
 * feature pages under each — exactly the sidebar's rows, in its order — and
 * the pages each feature's hub links to. The sidebar and the breadcrumb both
 * read it, so a page added here shows up in both, under the same name.
 *
 * Inert hub cards (features not built yet) aren't listed: a breadcrumb or a
 * sidebar row only ever points at a page that exists.
 */

export interface NavPage {
  label: string;
  href: string;
  children?: NavPage[];
  /**
   * Pages under this one that are one record each (`/dashboard/billing/[folioId]`):
   * any path starting with `prefix` that isn't a listed page, named `label` in
   * the trail.
   */
  detail?: { prefix: string; label: string };
}

export interface NavGroup {
  label: 'Operations' | 'Management' | 'Admin';
  /** Where the group's own crumb goes — its first feature. */
  href: string;
  items: NavPage[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Operations',
    href: '/dashboard',
    items: [
      { label: 'Alerts', href: '/dashboard/alerts' },
      {
        label: 'Front Desk',
        href: '/dashboard',
        children: [
          { label: 'Arrivals Dashboard', href: '/dashboard/arrivals' },
          { label: 'Check-In Flow', href: '/dashboard/check-in', detail: { prefix: '/dashboard/check-in/', label: 'Check-In' } },
          { label: 'Group Check-In', href: '/dashboard/group-check-in' },
          { label: 'Walk-In Booking', href: '/dashboard/walk-in-booking' },
          { label: 'Departures Dashboard', href: '/dashboard/departures' },
          { label: 'Check-Out Flow', href: '/dashboard/check-out' },
          { label: 'Room Move & Upgrade', href: '/dashboard/room-move' },
          { label: 'In-House Guest List', href: '/dashboard/in-house-guest-list' },
          { label: 'Room Status Board', href: '/dashboard/room-status-board' },
        ],
      },
      {
        label: 'Reservations',
        href: '/dashboard/reservations',
        children: [
          { label: 'Availability Calendar', href: '/dashboard/reservations/availability-calendar' },
          { label: 'Create Reservation', href: '/dashboard/reservations/create' },
          { label: 'Modify Reservation', href: '/dashboard/reservations/modify' },
          { label: 'Cancel Reservation', href: '/dashboard/reservations/cancel' },
          { label: 'Waitlist Management', href: '/dashboard/reservations/waitlist' },
        ],
      },
      {
        label: 'Housekeeping',
        href: '/dashboard/housekeeping',
        children: [
          { label: 'Task Board', href: '/dashboard/housekeeping/task-board' },
          { label: 'Staff Assignment', href: '/dashboard/housekeeping/staff-assignment' },
          { label: 'Inspection Workflow', href: '/dashboard/housekeeping/inspection-workflow' },
          { label: 'Room Blocking / OOO', href: '/dashboard/housekeeping/room-blocking' },
        ],
      },
      {
        label: 'Billing & Payments',
        href: '/dashboard/billing',
        children: [
          // A folio's own page lives at /dashboard/billing/[folioId], beside this list rather than under it.
          { label: 'Guest Folios', href: '/dashboard/billing/folios', detail: { prefix: '/dashboard/billing/', label: 'Folio' } },
          { label: 'Split Billing', href: '/dashboard/split-billing' },
          { label: 'Night Audit', href: '/dashboard/night-audit' },
          { label: 'Refunds & Corrections', href: '/dashboard/billing/refunds' },
        ],
      },
      {
        label: 'Folio Transfer',
        href: '/dashboard/folio-transfer',
        children: [
          { label: 'Transfer Charges', href: '/dashboard/folio-transfer/transfer' },
          { label: 'Create Secondary Folio', href: '/dashboard/folio-transfer/secondary-folio' },
          { label: 'Transfer History', href: '/dashboard/folio-transfer/history' },
        ],
      },
      {
        label: 'Point of Sale',
        href: '/dashboard/pos',
        children: [
          { label: 'POS Terminal', href: '/dashboard/pos/terminal' },
          { label: 'Menu Management', href: '/dashboard/pos/menu' },
        ],
      },
      { label: 'Shift Management', href: '/dashboard/shifts' },
      { label: 'No-Show Handling', href: '/dashboard/no-shows' },
      { label: 'Guest Reg. Card', href: '/dashboard/registration-cards', detail: { prefix: '/dashboard/registration-cards/', label: 'Registration Card' } },
      { label: 'Comms Log', href: '/dashboard/comms-log' },
    ],
  },
  {
    label: 'Management',
    href: '/dashboard/manager',
    items: [
      { label: 'Manager Dashboard', href: '/dashboard/manager' },
      { label: 'Overbooking Mgmt', href: '/dashboard/overbooking' },
      { label: 'Rate Resolver', href: '/dashboard/reservations/rate-plans' },
      {
        label: 'Guest Profiles & CRM',
        href: '/dashboard/guests',
        children: [
          { label: 'Guest Profiles', href: '/dashboard/guests/profiles', detail: { prefix: '/dashboard/guests/', label: 'Guest Profile' } },
          { label: 'Corporate Accounts', href: '/dashboard/guests/corporate' },
        ],
      },
      { label: 'Revenue Management', href: '/dashboard/revenue' },
      { label: 'Sales & Events', href: '/dashboard/sales-events' },
      { label: 'Maintenance', href: '/dashboard/maintenance' },
      {
        label: 'Loyalty & Marketing',
        href: '/dashboard/loyalty',
        children: [{ label: 'Email Campaigns', href: '/dashboard/loyalty/campaigns', detail: { prefix: '/dashboard/loyalty/campaigns/', label: 'Campaign' } }],
      },
      {
        label: 'Reports & Analytics',
        href: '/dashboard/reports',
        children: [{ label: 'Operational Reports', href: '/dashboard/reports/operational' }],
      },
    ],
  },
  {
    label: 'Admin',
    href: '/dashboard/property-config',
    items: [
      { label: 'Property Config', href: '/dashboard/property-config' },
      {
        label: 'Integrations & APIs',
        href: '/dashboard/integrations',
        children: [
          {
            label: 'Integrations Marketplace',
            href: '/dashboard/integrations/marketplace',
            detail: { prefix: '/dashboard/integrations/marketplace/', label: 'Integration' },
          },
        ],
      },
      { label: 'Security & Roles', href: '/dashboard/security' },
      { label: 'System Admin', href: '/dashboard/system-admin' },
      { label: 'Enterprise / HQ', href: '/dashboard/hq' },
    ],
  },
];

/** Pages outside the three groups — reached from the top bar, not the sidebar. */
const ACCOUNT_PAGE: NavPage = { label: 'My Account', href: '/dashboard/account' };

/** One step of the trail. `options` are the places one level across — the crumb's dropdown; `href: null` for a crumb that isn't a page of its own. */
export interface Crumb {
  label: string;
  href: string | null;
  options: Array<{ label: string; href: string }>;
}

type Found = { group: NavGroup | null; pages: NavPage[]; detail: string | null };

/** Every page with the trail that leads to it, depth first. */
const ENTRIES: Array<{ group: NavGroup; trail: NavPage[] }> = (() => {
  const entries: Array<{ group: NavGroup; trail: NavPage[] }> = [];
  const visit = (group: NavGroup, pages: NavPage[], trail: NavPage[]) => {
    for (const page of pages) {
      const next = [...trail, page];
      entries.push({ group, trail: next });
      visit(group, page.children ?? [], next);
    }
  };
  for (const group of NAV_GROUPS) visit(group, group.items, []);
  return entries;
})();

const last = (trail: NavPage[]) => trail[trail.length - 1];

function find(pathname: string): Found | null {
  if (pathname === ACCOUNT_PAGE.href) return { group: null, pages: [ACCOUNT_PAGE], detail: null };
  // A listed page first, wherever it sits; then a record page under one.
  const page = ENTRIES.find((entry) => last(entry.trail).href === pathname);
  if (page) return { group: page.group, pages: page.trail, detail: null };
  const record = ENTRIES.find((entry) => {
    const detail = last(entry.trail).detail;
    return detail !== undefined && pathname.startsWith(detail.prefix);
  });
  if (record) return { group: record.group, pages: record.trail, detail: last(record.trail).detail?.label ?? null };
  return null;
}

/** Siblings of `page` — the dropdown at its crumb. */
function siblingsOf(group: NavGroup, trail: NavPage[], index: number): NavPage[] {
  return index === 0 ? group.items : (trail[index - 1].children ?? []);
}

/**
 * The trail below the branch for a dashboard path — group, feature, the
 * page within it, and a record page's own crumb — with each level's
 * alternatives. Empty for a path that isn't on the map.
 */
export function breadcrumbTrail(pathname: string): Crumb[] {
  const found = find(pathname);
  if (!found) return [];
  if (!found.group) return found.pages.map((page) => ({ label: page.label, href: page.href, options: [] }));
  const { group, pages, detail } = found;
  const crumbs: Crumb[] = [
    { label: group.label, href: group.href, options: NAV_GROUPS.map((g) => ({ label: g.label, href: g.href })) },
    ...pages.map((page, index) => ({
      label: page.label,
      href: page.href,
      options: siblingsOf(group, pages, index).map((sibling) => ({ label: sibling.label, href: sibling.href })),
    })),
  ];
  if (detail) crumbs.push({ label: detail, href: null, options: [] });
  return crumbs;
}

/** The feature page (sidebar row) a path belongs to — what the sidebar highlights. */
export function activeFeatureHref(pathname: string): string | null {
  const found = find(pathname);
  return found?.group ? found.pages[0].href : null;
}

/** The deepest page in the trail that isn't one record's own page — where switching branch lands, since a folio or guest from one branch means nothing in another. */
export function branchSafeHref(pathname: string): string {
  const found = find(pathname);
  if (!found) return '/dashboard';
  return last(found.pages).href;
}
