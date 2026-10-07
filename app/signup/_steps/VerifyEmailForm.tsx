'use client';

import { useState } from 'react';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api';
import { resendVerification, verifyEmail } from '@/lib/account';
import { useWizardStore } from '@/lib/store/wizardStore';

/**
 * Step 1b — confirming the owner's email. Once an email provider is set up,
 * the link goes to their inbox and opens `/verify-email` (in another tab);
 * this step waits for that, offers to send it again, and carries on when
 * they say they've confirmed — the sign-in that follows proves it.
 *
 * Until email is set up there's no inbox to send to, so the API hands the
 * token back with the new account (`verificationToken`) and confirming
 * happens right here. That's the only case the token is ever on this page.
 *
 * If `emailVerified` is already true in `wizardStore` (navigated back here
 * after already confirming), this skips straight to `onNext()` — same
 * "don't get stuck re-submitting something already done" reasoning as
 * `RegisterForm`'s read-only mode.
 */
export function VerifyEmailForm({ onNext }: { onNext: () => void }) {
  const owner = useWizardStore((state) => state.owner);
  const verificationToken = useWizardStore((state) => state.verificationToken);
  const verificationEmailed = useWizardStore((state) => state.verificationEmailed);
  const emailVerified = useWizardStore((state) => state.emailVerified);
  const patch = useWizardStore((state) => state.patch);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resent, setResent] = useState<'idle' | 'working' | 'sent'>('idle');

  if (emailVerified) {
    return (
      <div className="flex flex-col gap-4">
        <Section label="Verify email">
          <p className="text-body text-surface">Email already verified — nothing to re-submit here.</p>
        </Section>
        <Button type="button" onClick={onNext}>
          Continue
        </Button>
      </div>
    );
  }

  async function confirmHere() {
    if (!verificationToken) return;
    setFormError(null);
    setSubmitting(true);
    try {
      await verifyEmail(verificationToken);
      patch({ emailVerified: true });
      onNext();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  async function sendAgain() {
    if (!owner?.email) return;
    setFormError(null);
    setResent('working');
    try {
      await resendVerification(owner.email);
      setResent('sent');
    } catch (error) {
      setResent('idle');
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  // No email provider: confirm on the page.
  if (verificationToken) {
    return (
      <div className="flex flex-col gap-4">
        <Section label="Verify email">
          <p className="text-small text-surface" id="verify-here">
            Account created for <span className="font-semibold">{owner?.email}</span>. Email isn’t set up on this system yet, so there’s no confirmation email
            to wait for — confirm it here instead.
          </p>
        </Section>
        {formError ? <p className="text-small text-red-600">{formError}</p> : null}
        <Button type="button" onClick={confirmHere} loading={submitting}>
          Confirm my email
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Section label="Verify email">
        {verificationEmailed || resent === 'sent' ? (
          <p className="text-small text-surface" id="verify-inbox">
            We’ve sent a confirmation link to <span className="font-semibold">{owner?.email}</span>. Open it — it works for 72 hours — then come back here and
            carry on. Look in your spam folder too if it hasn’t arrived in a few minutes.
          </p>
        ) : (
          <p className="text-small text-surface" id="verify-not-sent">
            Account created for <span className="font-semibold">{owner?.email}</span>, but the confirmation email couldn’t be sent just now. Send it again below.
          </p>
        )}
        {resent === 'sent' ? <p className="text-small text-green-700">A new link is on its way.</p> : null}
      </Section>
      {formError ? <p className="text-small text-red-600">{formError}</p> : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={onNext}>
          I’ve confirmed it — continue
        </Button>
        <Button type="button" variant="outline" onClick={sendAgain} loading={resent === 'working'}>
          Send it again
        </Button>
      </div>
    </div>
  );
}
