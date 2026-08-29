'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useMyBranches } from '@/lib/dashboardBranches';
import { useAuthStore } from '@/lib/store/authStore';
import { MenuIcon } from '@/components/ui/Icons';
import { BranchPicker } from './_components/BranchPicker';
import { Sidebar } from './_components/Sidebar';

/** Route → breadcrumb title. Extend this whenever a new `/dashboard/*` page is added — it used to be a two-way ternary hardcoded to exactly `/dashboard` vs. Room Status Board, which would have silently mislabeled every route added since. */
const ROUTE_TITLES: Record<string, string> = {
  '/dashboard/alerts': 'Alerts',
  '/dashboard/room-status-board': 'Room Status Board',
  '/dashboard/arrivals': 'Arrivals Dashboard',
  '/dashboard/departures': 'Departures Dashboard',
  '/dashboard/in-house-guest-list': 'In-House Guest List',
  '/dashboard/walk-in-booking': 'Walk-In Booking',
  '/dashboard/check-in': 'Check-In Flow',
  '/dashboard/check-out': 'Check-Out Flow',
  '/dashboard/billing': 'Guest Folio',
  '/dashboard/night-audit': 'Night Audit',
  '/dashboard/split-billing': 'Split Billing',
  '/dashboard/no-shows': 'No-Show Handling',
  '/dashboard/registration-cards': 'Guest Registration Card',
  '/dashboard/shifts': 'Shift Management',
  '/dashboard/comms-log': 'Guest Communications Log',
  '/dashboard/reports': 'Operational Reports',
  '/dashboard/reservations': 'Reservations',
  '/dashboard/reservations/availability-calendar': 'Availability Calendar',
  '/dashboard/reservations/create': 'Create Reservation',
  '/dashboard/reservations/modify': 'Modify Reservation',
  '/dashboard/reservations/cancel': 'Cancel Reservation',
  '/dashboard/reservations/waitlist': 'Waitlist Management',
  '/dashboard/reservations/rate-plans': 'Rate Plan Management',
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
  return ROUTE_TITLES[pathname] ?? '';
}

/**
 * The breadcrumb's middle segment — which top-level section a route
 * belongs to. Front Desk was the only section for most of this app's life,
 * so the breadcrumb hardcoded "Front Desk" unconditionally; once
 * Reservations and Housekeeping became real top-level sections (own
 * sidebar groups, own hub pages) that started rendering literally wrong
 * breadcrumbs like "Front Desk / Housekeeping" — found live, not by
 * inspection, the moment a second section existed to make it visible.
 *
 * Billing and Payments has no hub page of its own — its `href` here (and
 * `Sidebar.tsx`'s own `BILLING_SECTION.href`) both point at Guest Folio,
 * its first and most useful page, the same role a real hub plays for the
 * other three sections.
 *
 * "Management" groups pages that moved out of Reservations (Overbooking,
 * Rate Plan Management — the architecture map's own "Rate Resolver") plus
 * Reports and Analytics, matching `Sidebar.tsx`'s own `MANAGEMENT_SECTION`
 * exactly — same no-dedicated-hub fallback, `/dashboard/overbooking` as
 * the first real page. `/dashboard/reservations/rate-plans` MUST be listed
 * before the plain `/dashboard/reservations` prefix below — `Array.find`
 * takes the first match, and every `/reservations/*` route otherwise
 * matches that broader prefix first.
 */
const SECTIONS: Array<{ prefix: string; label: string; href: string }> = [
  { prefix: '/dashboard/alerts', label: 'Alerts', href: '/dashboard/alerts' },
  { prefix: '/dashboard/reservations/rate-plans', label: 'Management', href: '/dashboard/overbooking' },
  { prefix: '/dashboard/reservations', label: 'Reservations', href: '/dashboard/reservations' },
  { prefix: '/dashboard/overbooking', label: 'Management', href: '/dashboard/overbooking' },
  { prefix: '/dashboard/reports', label: 'Management', href: '/dashboard/overbooking' },
  { prefix: '/dashboard/housekeeping', label: 'Housekeeping', href: '/dashboard/housekeeping' },
  { prefix: '/dashboard/billing', label: 'Billing and Payments', href: '/dashboard/billing' },
  { prefix: '/dashboard/split-billing', label: 'Billing and Payments', href: '/dashboard/billing' },
  { prefix: '/dashboard/night-audit', label: 'Billing and Payments', href: '/dashboard/billing' },
  { prefix: '/dashboard/no-shows', label: 'Billing and Payments', href: '/dashboard/billing' },
  { prefix: '/dashboard/registration-cards', label: 'Billing and Payments', href: '/dashboard/billing' },
  { prefix: '/dashboard/shifts', label: 'Billing and Payments', href: '/dashboard/billing' },
  { prefix: '/dashboard/comms-log', label: 'Billing and Payments', href: '/dashboard/billing' },
];

function sectionFor(pathname: string): { label: string; href: string } {
  return SECTIONS.find((s) => pathname.startsWith(s.prefix)) ?? { label: 'Front Desk', href: '/dashboard' };
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
  const section = sectionFor(pathname);

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
            {pathname === section.href ? (
              <span className="font-semibold text-primary-dark truncate">{section.label}</span>
            ) : (
              <>
                <Link href={section.href} className="hidden sm:inline text-primary-text shrink-0 hover:underline">
                  {section.label}
                </Link>
                <span className="hidden sm:inline text-accent shrink-0">/</span>
                <span className="font-semibold text-primary-dark truncate">{pageTitleFor(pathname)}</span>
              </>
            )}
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
