'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { useMyBranches } from '@/lib/dashboardBranches';
import { useAuthStore } from '@/lib/store/authStore';
import { BranchPicker } from './_components/BranchPicker';
import { Sidebar } from './_components/Sidebar';

/** Route → breadcrumb title. Extend this whenever a new `/dashboard/*` page is added — it used to be a two-way ternary hardcoded to exactly `/dashboard` vs. Room Status Board, which would have silently mislabeled every route added since. */
const ROUTE_TITLES: Record<string, string> = {
  '/dashboard/room-status-board': 'Room Status Board',
  '/dashboard/arrivals': 'Arrivals Dashboard',
  '/dashboard/departures': 'Departures Dashboard',
  '/dashboard/in-house-guest-list': 'In-House Guest List',
  '/dashboard/walk-in-booking': 'Walk-In Booking',
};

function pageTitleFor(pathname: string): string {
  if (pathname.startsWith('/dashboard/check-in/')) return 'Check-In Flow';
  return ROUTE_TITLES[pathname] ?? '';
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
        <p className="text-body text-secondary-light">Loading your properties…</p>
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
        <p className="text-body text-secondary-light">No properties are set up on this account yet.</p>
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

  // `h-screen` + `overflow-hidden` (not `min-h-screen`) — same reasoning as
  // `WizardShell.tsx`'s identical shell: the browser window itself never
  // scrolls, header and sidebar stay visually fixed, and `main` is the only
  // part with its own `overflow-y-auto`.
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <header className="shrink-0 flex items-center justify-between gap-4 border-b border-accent/20 px-6 py-4">
        <div className="flex items-center gap-3 text-small min-w-0">
          <span className="font-display text-header font-bold text-primary-text shrink-0">Roomick</span>
          {activeBranchName ? (
            <>
              <span className="text-accent shrink-0">/</span>
              <span className="text-primary-text shrink-0">{activeBranchName}</span>
            </>
          ) : null}
          <span className="text-accent shrink-0">/</span>
          {pathname === '/dashboard' ? (
            <span className="font-semibold text-secondary truncate">Front Desk</span>
          ) : (
            <>
              <Link href="/dashboard" className="text-primary-text shrink-0 hover:underline">
                Front Desk
              </Link>
              <span className="text-accent shrink-0">/</span>
              <span className="font-semibold text-secondary truncate">{pageTitleFor(pathname)}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-4 shrink-0 text-small">
          <span className="text-secondary-light">{user?.name}</span>
          <button
            type="button"
            onClick={handleLogout}
            className="font-semibold text-secondary border border-accent/40 rounded-control px-4 py-2 hover:bg-accent/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            Log out
          </button>
        </div>
      </header>
      <div className="flex flex-1 min-h-0">
        <Sidebar />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
