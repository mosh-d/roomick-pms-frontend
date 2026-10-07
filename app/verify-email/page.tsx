'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { ApiError } from '@/lib/api';
import { verifyEmail } from '@/lib/account';

/**
 * Where the confirmation link from sign-up lands. Confirming is all it does;
 * the sign-up page left open in the other tab carries on from there, or the
 * owner logs in.
 */
export default function VerifyEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerifyEmail />
    </Suspense>
  );
}

function VerifyEmail() {
  const token = useSearchParams().get('token') ?? '';
  const [state, setState] = useState<'working' | 'done' | { error: string }>('working');

  useEffect(() => {
    let cancelled = false;
    // Confirming twice is harmless — the second time finds it already done.
    verifyEmail(token)
      .then(() => {
        if (!cancelled) setState('done');
      })
      .catch((err: unknown) => {
        if (!cancelled) setState({ error: err instanceof ApiError ? err.message : 'Couldn’t confirm your email. Check your connection and try again.' });
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (state === 'working') {
    return (
      <Container className="max-w-xl py-16">
        <p className="text-body text-surface-muted">Confirming your email…</p>
      </Container>
    );
  }

  if (state === 'done') {
    return (
      <Container className="max-w-xl py-16 flex flex-col gap-4">
        <h1 className="font-display text-title font-bold text-surface" id="verify-done">
          Your email is confirmed
        </h1>
        <p className="text-body text-surface">
          If the sign-up page is still open, go back to it and choose <span className="font-semibold">I’ve confirmed it — continue</span>. Otherwise, log in to
          carry on setting up.
        </p>
        <Link
          href="/login?verified=1"
          className="inline-flex items-center justify-center gap-2 rounded-control font-semibold cursor-pointer transition-[filter] bg-primary text-white hover:brightness-125 hover:text-surface px-4 py-2 text-body min-h-11 w-fit"
        >
          Log in
        </Link>
      </Container>
    );
  }

  return (
    <Container className="max-w-xl py-16 flex flex-col gap-4">
      <h1 className="font-display text-title font-bold text-surface">This link can’t be used</h1>
      <p className="text-body text-surface" id="verify-error">
        {state.error}
      </p>
      <p className="text-small text-surface-muted">
        Links work for 72 hours.{' '}
        <Link href="/login" className="text-surface-accent font-semibold hover:underline">
          Log in
        </Link>{' '}
        to have a new one sent.
      </p>
    </Container>
  );
}
