'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store/authStore';
import { useWizardStore } from '@/lib/store/wizardStore';
import { ApiError } from '@/lib/api';

/**
 * Bridges register/verify-email (neither issues an access token — see
 * RegisterForm/VerifyEmailForm) to the rest of the wizard, which needs one:
 * `configure-mode`, branch/room-type/room creation all require
 * `Authorization: Bearer` + `X-Tenant-ID` (backend's TenantGuard). Rather
 * than build a standalone /login page for this one moment, this step
 * silently logs the owner in with the credentials they just typed during
 * registration (see RegisterForm's onSuccess) — a completely standard
 * "verify → signed in automatically" pattern, and simpler than making them
 * retype what they just entered thirty seconds ago.
 *
 * Two cases beyond the normal one:
 *  - `wizardStore.loggedIn` already true (navigated back here after already
 *    signing in) — skip straight to `onSuccess()`, same "don't redo
 *    already-done work" pattern as RegisterForm/VerifyEmailForm.
 *  - `password` is empty — happens when `RegisterForm` was already in its
 *    read-only "account already exists" state (see that file), which has
 *    no password to hand forward. `authStore`'s token is persisted (see
 *    that store's header comment), so this is usually already covered by
 *    the case above; if it somehow isn't (e.g. the persisted session
 *    itself expired), there's nothing this step can silently do about a
 *    missing password — it points at the real `/login` page instead of
 *    trying (and predictably failing) a login call with an empty one.
 */
export function AutoLoginStep({
  email,
  password,
  onSuccess,
}: {
  email: string;
  password: string;
  onSuccess: () => void;
}) {
  const login = useAuthStore((state) => state.login);
  const loggedIn = useWizardStore((state) => state.loggedIn);
  const owner = useWizardStore((state) => state.owner);
  const patch = useWizardStore((state) => state.patch);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (loggedIn || !password) return;
    let cancelled = false;
    // No setState synchronously in the effect body (lint: react-hooks/set-state-in-effect)
    // — `error` only gets set from the async .catch below, and cleared by the
    // Retry button's own click handler before it bumps retryKey, not here.
    login(email, password, owner?.subdomain ?? '')
      .then(() => {
        if (!cancelled) {
          patch({ loggedIn: true });
          onSuccess();
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      });
    return () => {
      cancelled = true;
    };
    // email/password/owner/login/onSuccess/patch intentionally excluded so a
    // parent re-render doesn't re-trigger the request — only a real retry
    // (bumping retryKey) or the loggedIn/password guard above should.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey, loggedIn, password]);

  if (loggedIn) {
    return (
      <Section label="Signed in">
        <p className="text-body text-secondary">Already signed in — nothing to redo here.</p>
        <Button type="button" onClick={onSuccess}>
          Continue
        </Button>
      </Section>
    );
  }

  if (!password) {
    return (
      <Section label="Sign in required">
        <p className="text-small text-secondary-light">
          Your session isn&apos;t active, and there&apos;s no password to sign you back in with automatically. Log
          in to continue.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center gap-2 rounded-control font-semibold cursor-pointer transition-[filter] bg-primary text-white hover:brightness-125 hover:text-secondary px-4 py-2 text-body min-h-11 w-fit"
        >
          Go to login
        </Link>
      </Section>
    );
  }

  return (
    <Section label="Signing you in">
      {error ? (
        <>
          <p className="text-small text-red-600">{error}</p>
          <Button
            type="button"
            onClick={() => {
              setError(null);
              setRetryKey((key) => key + 1);
            }}
          >
            Retry
          </Button>
        </>
      ) : (
        <p className="text-body text-secondary-light">One moment…</p>
      )}
    </Section>
  );
}
