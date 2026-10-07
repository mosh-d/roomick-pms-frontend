'use client';

import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api';
import { requestPasswordReset } from '@/lib/account';

/**
 * "Forgot your password?". The answer is the same whether or not the address
 * has an account — only whether email is set up on this system changes it:
 * until it is, there's no link to send, and a manager or the owner makes one
 * from Staff Management instead.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<{ email: string; emailEnabled: boolean } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setError('Enter a valid email');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const result = await requestPasswordReset(address);
      setOutcome({ email: address, emailEnabled: result.emailEnabled });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container className="max-w-xl py-16 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-title font-bold text-surface mb-2">Forgot your password?</h1>
        <p className="text-body text-surface-muted">Enter the email you sign in with, and we’ll send you a link to choose a new password.</p>
      </div>

      {outcome ? (
        <Card tone="accent" className="flex flex-col gap-2" id="forgot-outcome">
          {outcome.emailEnabled ? (
            <>
              <p className="text-body font-semibold text-surface">Check your inbox</p>
              <p className="text-small text-surface">
                If {outcome.email} has a Roomick account, a link to choose a new password is on its way. It works once, for an hour — look in your spam folder
                too if it doesn’t arrive in a few minutes.
              </p>
            </>
          ) : (
            <>
              <p className="text-body font-semibold text-surface">Ask your manager for a link</p>
              <p className="text-small text-surface">
                Email isn’t set up on this system yet, so a link can’t be sent. Your manager — or the owner — can make you one from Staff Management, to open on
                this computer or your phone.
              </p>
            </>
          )}
        </Card>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Section label="Account">
            <Input id="forgot-email" label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error ?? undefined} />
          </Section>
          <Button type="submit" loading={submitting}>
            Send the link
          </Button>
        </form>
      )}

      <p className="text-small text-surface-muted">
        Remembered it?{' '}
        <Link href="/login" className="text-surface-accent font-semibold hover:underline">
          Log in
        </Link>
      </p>
    </Container>
  );
}
