'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
 * existing session) — a caller should render `null` while `!ready`, same
 * as `/login/page.tsx` already did. Once hydrated, an absent `user`
 * redirects to `/login` via `router.replace` (not `push` — a signed-out
 * visit to a protected route shouldn't leave a back-button trail into it).
 */
export function useRequireAuth() {
  const hydrated = useHasHydrated(useAuthStore);
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !user) router.replace('/login');
  }, [hydrated, user, router]);

  return { ready: hydrated && !!user, user, accessToken };
}
