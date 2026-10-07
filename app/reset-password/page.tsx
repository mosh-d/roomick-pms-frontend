'use client';

import Link from 'next/link';
import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api';
import { newPasswordSchema, resetPassword } from '@/lib/account';

/**
 * Where a password-reset link lands — emailed on request, or made by a
 * manager. Choosing the new password ends every session the account had;
 * then it's the sign-in page, two-step sign-in included.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPassword />
    </Suspense>
  );
}

function ResetPassword() {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ password?: string; confirm?: string; form?: string }>({});
  const [linkDead, setLinkDead] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: typeof errors = {};
    const strength = newPasswordSchema.safeParse(password);
    if (!strength.success) next.password = strength.error.issues[0]?.message;
    if (confirm !== password) next.confirm = 'The two passwords don’t match';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      await resetPassword(token, password);
      router.replace('/login?reset=1');
    } catch (err) {
      if (err instanceof ApiError && err.isCode('TOKEN_INVALID')) setLinkDead(true);
      else setErrors({ form: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
      setSubmitting(false);
    }
  }

  if (!token || linkDead) {
    return (
      <Container className="max-w-xl py-16 flex flex-col gap-4">
        <h1 className="font-display text-title font-bold text-surface">This link can’t be used</h1>
        <p className="text-body text-surface" id="reset-link-dead">
          It has expired or was already used. Each link works once.
        </p>
        <p className="text-small text-surface-muted">
          <Link href="/forgot-password" className="text-surface-accent font-semibold hover:underline">
            Ask for a new one
          </Link>{' '}
          or{' '}
          <Link href="/login" className="text-surface-accent font-semibold hover:underline">
            log in
          </Link>
          .
        </p>
      </Container>
    );
  }

  return (
    <Container className="max-w-xl py-16 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-title font-bold text-surface mb-2">Choose a new password</h1>
        <p className="text-body text-surface-muted">Every browser signed in to your account is signed out once it’s changed.</p>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Section label="New password">
          <Input
            id="reset-password"
            label="New password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            hint="At least 8 characters, with an upper-case letter, a lower-case letter and a number."
          />
          <Input id="reset-confirm" label="Type it again" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
        </Section>
        {errors.form ? <p className="text-small text-red-600">{errors.form}</p> : null}
        <Button type="submit" loading={submitting}>
          Save new password
        </Button>
      </form>
    </Container>
  );
}
