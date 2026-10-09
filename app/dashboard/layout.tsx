'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import { useRequireAuth } from '@/lib/useRequireAuth';
import { hasBeenIdleTooLong, markActivity } from '@/lib/session';
import { useMyBranches } from '@/lib/dashboardBranches';
import { setHotelTimezone } from '@/lib/dates';
import { SessionPending } from '@/components/SessionPending';
import { useAuthStore } from '@/lib/store/authStore';
import { MenuIcon } from '@/components/ui/Icons';
import { BranchPicker } from './_components/BranchPicker';
import { PageAccessProvider, PageGate } from './_components/PageAccess';
import { Breadcrumbs } from './_components/Breadcrumbs';
import { SessionEndedPrompt } from './_components/SessionEndedPrompt';
import { Sidebar } from './_components/Sidebar';

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
  const { ready, user, accessToken, restoring, restoreFailed } = useRequireAuth();
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const setActiveBranchId = useAuthStore((s) => s.setActiveBranchId);
  const logout = useAuthStore((s) => s.logout);
  const sessionEnded = useAuthStore((s) => s.sessionEnded);
  const sessionEndedReason = useAuthStore((s) => s.sessionEndedReason);
  const endSession = useAuthStore((s) => s.endSession);
  const leaveEndedSession = useAuthStore((s) => s.leaveEndedSession);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // `useRequireAuth` takes it from here: a sign-out lands on a clean sign-in page.
  function handleLogout() {
    void logout();
  }

  // An hour with nobody at the screen ends the session where it stands
  // (lib/session.ts): checked every half minute and the moment the tab is
  // looked at again, not left to whichever request next needs a renewal.
  // Only a click or a key counts as someone being here — throttled to one
  // stamp a minute — and one that arrives after the hour ran out ends the
  // session rather than reviving it.
  useEffect(() => {
    if (!ready) return;
    let lastStamp = 0;
    const lapsed = () => {
      if (!hasBeenIdleTooLong()) return false;
      endSession();
      return true;
    };
    const touched = () => {
      if (lapsed()) return;
      const now = Date.now();
      if (now - lastStamp < 60_000) return;
      lastStamp = now;
      markActivity();
    };
    const visibility = () => {
      if (document.visibilityState === 'visible') lapsed();
    };
    lapsed();
    const timer = window.setInterval(lapsed, 30_000);
    window.addEventListener('pointerdown', touched, { passive: true });
    window.addEventListener('keydown', touched, { passive: true });
    window.addEventListener('focus', lapsed);
    window.addEventListener('pageshow', lapsed);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('pointerdown', touched);
      window.removeEventListener('keydown', touched);
      window.removeEventListener('focus', lapsed);
      window.removeEventListener('pageshow', lapsed);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [ready, endSession]);

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

  if (!ready) return restoring || restoreFailed ? <SessionPending failed={restoreFailed} /> : null;

  if (branchesQuery.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-body text-surface-muted">Loading your properties…</p>
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
        <p className="text-body text-surface-muted">No properties are set up on this account yet.</p>
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

  // The hotel's clock for every page below: times and "today" in the branch's timezone.
  setHotelTimezone(branches?.find((b) => b.id === activeBranchId)?.timezone);

  // `h-screen` + `overflow-hidden` (not `min-h-screen`) — same reasoning as
  // `WizardShell.tsx`'s identical shell: the browser window itself never
  // scrolls, header and sidebar stay visually fixed, and `main` is the only
  // part with its own `overflow-y-auto`.
  // Which pages this person opens here (Staff Management → Page Access) shapes
  // the sidebar and breadcrumbs, and `PageGate` keeps the rest from opening.
  return (
    <PageAccessProvider branchId={activeBranchId}>
      <div className="h-screen flex flex-col overflow-hidden">
        <header className="shrink-0 flex items-center justify-between gap-3 border-b border-accent/20 px-4 sm:px-6 py-4 print:hidden">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              className="md:hidden shrink-0 rounded-control border border-primary/30 p-2 text-surface hover:bg-primary-light/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <MenuIcon className="size-5" />
            </button>
            <Link href="/dashboard" className="font-display text-header font-bold text-surface-accent shrink-0">
              Roomick
            </Link>
            {/* The trail is wide-screen only (see Breadcrumbs) — below `lg` the bar keeps just the logo. */}
            <span aria-hidden className="hidden lg:inline text-accent shrink-0">
              /
            </span>
            <Breadcrumbs branches={branches ?? []} />
          </div>
          <div className="flex items-center gap-4 shrink-0 text-small">
            {/* Everyone's way to their own sign-in settings — two-step sign-in lives there. */}
            <Link href="/dashboard/account" className="hidden sm:inline text-surface-muted hover:text-surface hover:underline" title="My Account">
              {user?.name}
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              className="font-semibold text-surface border border-primary/40 rounded-control px-4 py-2 hover:bg-primary-light/40 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Log out
            </button>
          </div>
        </header>
        {/* Over the page rather than instead of it: the page stays where it was, and signing back in returns to it. */}
        {sessionEnded ? <SessionEndedPrompt reason={sessionEndedReason} onSignIn={() => void leaveEndedSession()} /> : null}
        <div className="flex flex-1 min-h-0">
          <Sidebar mobileOpen={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
          {/* `relative` keeps every absolutely-positioned element on a page —
              the visually-hidden radios behind each radio group (`sr-only` is
              `position: absolute`) — inside this scroll box. Without it they
              sit relative to the viewport instead: one far down a long form
              stretched the window itself, and scrolling ran on past the page
              into blank space. */}
          <main className="relative flex-1 overflow-y-auto">
            <PageGate>{children}</PageGate>
          </main>
        </div>
      </div>
    </PageAccessProvider>
  );
}
