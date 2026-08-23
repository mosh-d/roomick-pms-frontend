'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { apiFetch, ApiError } from '@/lib/api';
import { verifyEmailSchema, type VerifyEmailFormValues } from '@/lib/schemas/auth';
import { useWizardStore } from '@/lib/store/wizardStore';

/**
 * Step 1b — email verification. The token is a real stubbed JWT the backend
 * hands back directly in the register response (`verificationToken`, its
 * own DTO comment says "stubbed in MVP"), since no email-sending
 * infrastructure exists yet. Pre-filling it here is a deliberate, visible
 * dev convenience — not something a production build should do once real
 * email delivery lands.
 *
 * If `emailVerified` is already true in `wizardStore` (navigated back here
 * after already verifying), this skips straight to `onNext()` — same
 * "don't get stuck re-submitting something already done" reasoning as
 * `RegisterForm`'s read-only mode.
 */
export function VerifyEmailForm({ onNext }: { onNext: () => void }) {
  const owner = useWizardStore((state) => state.owner);
  const verificationToken = useWizardStore((state) => state.verificationToken);
  const emailVerified = useWizardStore((state) => state.emailVerified);
  const patch = useWizardStore((state) => state.patch);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailFormValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { token: verificationToken ?? '' },
    mode: 'onTouched',
  });

  if (emailVerified) {
    return (
      <div className="flex flex-col gap-4">
        <Section label="Verify email">
          <p className="text-body text-secondary">Email already verified — nothing to re-submit here.</p>
        </Section>
        <Button type="button" onClick={onNext}>
          Continue
        </Button>
      </div>
    );
  }

  async function onSubmit(values: VerifyEmailFormValues) {
    setFormError(null);
    try {
      await apiFetch<{ verified: true }>('/auth/verify-email', { method: 'POST', body: values });
      patch({ emailVerified: true });
      onNext();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Section label="Verify email">
        <p className="text-small text-secondary-light">
          Account created for <span className="font-semibold">{owner?.email}</span>. No email-sending is wired
          up yet (the backend&apos;s own DTO comment says this token is &quot;stubbed in MVP&quot;) — it&apos;s
          pre-filled below so you can continue; a real deployment would require checking your inbox instead.
        </p>
        <Input label="Verification token" {...register('token')} error={errors.token?.message} />
      </Section>

      {formError ? <p className="text-small text-red-600">{formError}</p> : null}

      <Button type="submit" loading={isSubmitting}>
        Verify email
      </Button>
    </form>
  );
}
