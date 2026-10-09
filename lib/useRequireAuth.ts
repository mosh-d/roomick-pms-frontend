'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from './store/authStore';
import { useHasHydrated } from './useHasHydrated';

/**
 * The one reusable auth gate for every authenticated route past `/login` —
 * generalizes the inline `useHasHydrated` + branch-on-`user` pattern
 * `/login/page.tsx` used before this existed, since `/dashboard` is no
 * longer the only route that needs it.
 *
 * `ready` stays `false` until the persisted `authStore` has actually
 * hydrated (see `useHasHydrated`'s own header comment on why this can't be
 * skipped — it's what avoids a login-form flash on a reload with an
 * existing session) and, after a page load, the session cookie has given
 * back an access token — `restoring` meanwhile, `restoreFailed` when the API
 * couldn't be reached. A caller renders `SessionPending` (or `null`) while
 * `!ready`. Once hydrated, an absent `user`
 * redirects to `/login` via `router.replace` (not `push` — a signed-out
 * visit to a protected route shouldn't leave a back-button trail into it).
 */
export function useRequireAuth() {
  const hydrated = useHasHydrated(useAuthStore);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const signedOut = useAuthStore((s) => s.signedOut);
  const restoring = useAuthStore((s) => s.restoring);
  const restoreFailed = useAuthStore((s) => s.restoreFailed);
  const router = useRouter();
  const pathname = usePathname();

  // Back to this page once signed in again (`?next=`) — except after a
  // deliberate sign-out, when the next person at this computer starts fresh.
  useEffect(() => {
    if (hydrated && !user) router.replace(signedOut ? '/login' : `/login?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, user, router, signedOut, pathname]);

  // Signed in, but the page has just loaded: no access token until the
  // session cookie gives one (authStore's `restoreSession`).
  return { ready: hydrated && !!user && !!accessToken, user, accessToken, restoring: hydrated && restoring, restoreFailed: hydrated && restoreFailed };
}
