'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useMyBranches } from '@/lib/dashboardBranches';
import { useAuthStore } from '@/lib/store/authStore';
import { MenuIcon } from '@/components/ui/Icons';
import { BranchPicker } from './_components/BranchPicker';
import { Sidebar } from './_components/Sidebar';

/** Route → breadcrumb title. Extend this whenever a new `/dashboard/*` page is added — it used to be a two-way ternary hardcoded to exactly `/dashboard` vs. Room Status Board, which would have silently mislabeled every route added since. */
const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Front Desk',
  '/dashboard/alerts': 'Alerts',
  '/dashboard/manager': 'Manager Dashboard',
  '/dashboard/security': 'Security & Roles',
  '/dashboard/property-config': 'Property Config',
  '/dashboard/maintenance': 'Maintenance',
  '/dashboard/guests': 'Guest Profiles & CRM',
  '/dashboard/revenue': 'Revenue Management',
  '/dashboard/sales-events': 'Sales & Events',
  '/dashboard/loyalty': 'Loyalty & Marketing',
  '/dashboard/integrations': 'Integrations & APIs',
  '/dashboard/system-admin': 'System Admin',
  '/dashboard/hq': 'Enterprise / HQ',
  '/dashboard/folio-transfer': 'Folio Transfer',
  '/dashboard/pos': 'Point of Sale',
  '/dashboard/pos/terminal': 'POS Terminal',
  '/dashboard/pos/menu': 'Menu Management',
  '/dashboard/room-status-board': 'Room Status Board',
  '/dashboard/arrivals': 'Arrivals Dashboard',
  '/dashboard/departures': 'Departures Dashboard',
  '/dashboard/in-house-guest-list': 'In-House Guest List',
  '/dashboard/walk-in-booking': 'Walk-In Booking',
  '/dashboard/check-in': 'Check-In Flow',
  '/dashboard/check-out': 'Check-Out Flow',
  '/dashboard/billing': 'Billing and Payments',
  '/dashboard/night-audit': 'Night Audit',
  '/dashboard/split-billing': 'Split Billing',
  '/dashboard/no-shows': 'No-Show Handling',
  '/dashboard/registration-cards': 'Guest Registration Card',
  '/dashboard/shifts': 'Shift Management',
  '/dashboard/comms-log': 'Guest Communications Log',
  '/dashboard/reports': 'Reports & Analytics',
  '/dashboard/reports/operational': 'Operational Reports',
  '/dashboard/reservations': 'Reservations',
  '/dashboard/reservations/availability-calendar': 'Availability Calendar',
  '/dashboard/reservations/create': 'Create Reservation',
  '/dashboard/reservations/modify': 'Modify Reservation',
  '/dashboard/reservations/cancel': 'Cancel Reservation',
  '/dashboard/reservations/waitlist': 'Waitlist Management',
  '/dashboard/reservations/rate-plans': 'Rate Resolver',
  '/dashboard/overbooking': 'Overbooking Management',
  '/dashboard/housekeeping': 'Housekeeping',
  '/dashboard/housekeeping/task-board': 'Task Board',
  '/dashboard/housekeeping/staff-assignment': 'Staff Assignment',
  '/dashboard/housekeeping/inspection-workflow': 'Inspection Workflow',
  '/dashboard/housekeeping/room-blocking': 'Room Blocking / OOO',
};

function pageTitleFor(pathname: string): string {
  if (pathname.startsWith('/dashboard/check-in/')) return 'Check-In Flow';
  if (pathname.startsWith('/dashboard/billing/')) return 'Guest Folio';
  if (pathname.startsWith('/dashboard/registration-cards/')) return 'Guest Registration Card';
  if (pathname.startsWith('/dashboard/guests/')) return 'Guest Profile';
  return ROUTE_TITLES[pathname] ?? '';
}

/**
 * The breadcrumb's leading segment — which of the three architecture-map
 * groups (Operations / Management / Admin) a route belongs to. Always
 * plain text, never a link — pixel-checked against the reference: every
 * one of its screenshots shows "Operations", "Management", or "Admin" as
 * dim, non-interactive text, exactly like `Sidebar.tsx`'s own
 * `SidebarGroupLabel` for the same three names. There is no "Management"
 * or "Admin" hub page to link to any more — the reference never has one;
 * MANAGEMENT and ADMIN are pure section labels over a flat list of peer
 * pages, same as OPERATIONS always was.
 *
 * The breadcrumb's own SECOND segment is always the current page's own
 * title (`pageTitleFor`) — including on a section's own hub page itself
 * (e.g. Front Desk's hub reads "Operations / Front Desk", never collapsed
 * to "Operations" alone). An earlier version collapsed to one segment
 * when `pathname === section.href`; the reference never does this.
 *
 * `/dashboard/reservations/rate-plans` MUST be listed before the plain
 * `/dashboard/reservations` prefix below — `Array.find` takes the first
 * match, and every `/reservations/*` route otherwise matches that broader
 * prefix first.
 */
type Group = 'Operations' | 'Management' | 'Admin';
const GROUP_PREFIXES: Array<{ prefix: string; group: Group }> = [
  { prefix: '/dashboard/alerts', group: 'Operations' },
  { prefix: '/dashboard/reservations/rate-plans', group: 'Management' },
  { prefix: '/dashboard/reservations', group: 'Operations' },
  { prefix: '/dashboard/housekeeping', group: 'Operations' },
  { prefix: '/dashboard/billing', group: 'Operations' },
  { prefix: '/dashboard/split-billing', group: 'Operations' },
  { prefix: '/dashboard/night-audit', group: 'Operations' },
  { prefix: '/dashboard/folio-transfer', group: 'Operations' },
  { prefix: '/dashboard/pos', group: 'Operations' },
  { prefix: '/dashboard/shifts', group: 'Operations' },
  { prefix: '/dashboard/no-shows', group: 'Operations' },
  { prefix: '/dashboard/registration-cards', group: 'Operations' },
  { prefix: '/dashboard/comms-log', group: 'Operations' },
  { prefix: '/dashboard/manager', group: 'Management' },
  { prefix: '/dashboard/overbooking', group: 'Management' },
  { prefix: '/dashboard/guests', group: 'Management' },
  { prefix: '/dashboard/revenue', group: 'Management' },
  { prefix: '/dashboard/sales-events', group: 'Management' },
  { prefix: '/dashboard/maintenance', group: 'Management' },
  { prefix: '/dashboard/loyalty', group: 'Management' },
  { prefix: '/dashboard/reports', group: 'Management' },
  { prefix: '/dashboard/property-config', group: 'Admin' },
  { prefix: '/dashboard/integrations', group: 'Admin' },
  { prefix: '/dashboard/security', group: 'Admin' },
  { prefix: '/dashboard/system-admin', group: 'Admin' },
  { prefix: '/dashboard/hq', group: 'Admin' },
];

function groupFor(pathname: string): Group {
  return GROUP_PREFIXES.find((s) => pathname.startsWith(s.prefix))?.group ?? 'Operations';
}

/**
 * The auth gate + branch resolution + shared shell for every authenticated
 * route under `/dashboard`. Owns branch resolution rather than `/login` —
 * "which branch am I working in" is a dashboard-shell concern that any
 * future authenticated route will also need, not something specific to
 * the login moment.
 *
 * Three states, in order:
 * 1. `!ready` (auth not yet hydrated, or not signed in — `useRequireAuth`
 *    already redirects to `/login` for the latter): render `null`, same
 *    hydration-flash-avoidance precedent `/login/page.tsx` established.
 * 2. Resolved branches.length > 1 and no `activeBranchId` picked yet:
 *    render `BranchPicker` in place of `children` entirely.
 * 3. Otherwise: exactly one branch auto-selects via `useEffect` (not
 *    inline during render — a Zustand `set()` call belongs in an effect
 *    or event handler, not a component body, same "patch external state
 *    once a condition is met" pattern `BranchSetupForm.tsx`'s own
 *    bootstrap-guard effect already uses) — this is the fix for a real,
 *    confirmed gap: an owner's own role is always `branchId: null`, so
 *    nothing else ever set `activeBranchId` for the only kind of account
 *    onboarding can currently produce. Once selected (auto or picked),
 *    the shared shell (property/user name, Log out) wraps `children`.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, user, accessToken } = useRequireAuth();
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const setActiveBranchId = useAuthStore((s) => s.setActiveBranchId);
  const clear = useAuthStore((s) => s.clear);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  function handleLogout() {
    clear();
    router.replace('/login');
  }

  const branchesQuery = useMyBranches(ready ? user : null, {
    accessToken: accessToken ?? undefined,
    tenantId: user?.tenantId,
  });
  const branches = branchesQuery.data;

  useEffect(() => {
    if (branches && branches.length === 1 && !activeBranchId) {
      setActiveBranchId(branches[0].id);
    }
  }, [branches, activeBranchId, setActiveBranchId]);

  if (!ready) return null;

  if (branchesQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-body text-primary-dark/70">Loading your properties…</p>
      </div>
    );
  }

  if (branchesQuery.isError) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-body text-red-600">Could not load your properties. Please try refreshing.</p>
      </div>
    );
  }

  if (branches && branches.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-body text-primary-dark/70">No properties are set up on this account yet.</p>
      </div>
    );
  }

  if (branches && branches.length > 1 && !activeBranchId) {
    return <BranchPicker branches={branches} onSelect={(branchId) => setActiveBranchId(branchId)} />;
  }

  // Exactly-one-branch case: the effect above hasn't committed
  // `activeBranchId` yet on this same render pass — render null for this
  // one tick rather than flash the shell with a stale/empty branch name.
  if (!activeBranchId) return null;

  const activeBranchName = branches?.find((b) => b.id === activeBranchId)?.name;
  const group = groupFor(pathname);

  // `h-screen` + `overflow-hidden` (not `min-h-screen`) — same reasoning as
  // `WizardShell.tsx`'s identical shell: the browser window itself never
  // scrolls, header and sidebar stay visually fixed, and `main` is the only
  // part with its own `overflow-y-auto`.
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="shrink-0 flex items-center justify-between gap-3 border-b border-accent/20 px-4 sm:px-6 py-4 print:hidden">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
            className="md:hidden shrink-0 rounded-control border border-primary/30 p-2 text-primary-dark hover:bg-primary-light/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <MenuIcon className="size-5" />
          </button>
          {/* Roomick / branch / section are dropped below `sm` — the current page name is the one thing that must survive at a phone's width; the header's own overflow-hidden clips anything that still doesn't fit rather than letting it overlap the right-hand controls the way the un-hidden trail used to. */}
          <div className="flex items-center gap-3 text-small min-w-0 overflow-hidden">
            <span className="hidden sm:inline font-display text-header font-bold text-primary-text shrink-0">Roomick</span>
            {activeBranchName ? (
              <>
                <span className="hidden sm:inline text-accent shrink-0">/</span>
                <span className="hidden sm:inline text-primary-text shrink-0">{activeBranchName}</span>
              </>
            ) : null}
            <span className="hidden sm:inline text-accent shrink-0">/</span>
            <span className="hidden sm:inline text-primary-text shrink-0">{group}</span>
            <span className="hidden sm:inline text-accent shrink-0">/</span>
            <span className="font-semibold text-primary-dark truncate">{pageTitleFor(pathname)}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 shrink-0 text-small">
          <span className="hidden sm:inline text-primary-dark/70">{user?.name}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="font-semibold text-primary-dark border border-primary/40 rounded-control px-4 py-2 hover:bg-primary-light/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Log out
          </button>
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
