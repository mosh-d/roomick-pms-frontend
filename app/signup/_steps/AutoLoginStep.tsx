'use client';

import { useEffect, useState } from 'react';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/lib/store/authStore';
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
 * A real `/login` page (for returning visits) is still open work — see
 * PHASE_NOTES.md — this only covers the immediate post-verify moment.
 */
export function AutoLoginStep({
  email,
  password,
  subdomain,
  onSuccess,
}: {
  email: string;
  password: string;
  subdomain: string;
  onSuccess: () => void;
}) {
  const login = useAuthStore((state) => state.login);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    login(email, password, subdomain)
      .then(() => {
        if (!cancelled) onSuccess();
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      });
    return () => {
      cancelled = true;
    };
    // email/password/subdomain are fixed for this step's lifetime; login/onSuccess
    // intentionally excluded so a parent re-render doesn't re-trigger the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryKey]);

  return (
    <Section label="Signing you in">
      {error ? (
        <>
          <p className="text-small text-red-600">{error}</p>
          <Button type="button" onClick={() => setRetryKey((key) => key + 1)}>
            Retry
          </Button>
        </>
      ) : (
        <p className="text-body text-secondary-light">One moment…</p>
      )}
    </Section>
  );
}
