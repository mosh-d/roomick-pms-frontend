'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { apiFetch, ApiError } from '@/lib/api';
import { verifyEmailSchema, type VerifyEmailFormValues } from '@/lib/schemas/auth';

/**
 * Step 1b — email verification. The token is a real stubbed JWT the backend
 * hands back directly in the register response (`verificationToken`, its
 * own DTO comment says "stubbed in MVP"), since no email-sending
 * infrastructure exists yet. Pre-filling it here is a deliberate, visible
 * dev convenience — not something a production build should do once real
 * email delivery lands.
 */
export function VerifyEmailForm({
  subdomain,
  initialToken,
  onSuccess,
}: {
  subdomain: string;
  initialToken: string;
  onSuccess: () => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<VerifyEmailFormValues>({
    resolver: zodResolver(verifyEmailSchema),
    defaultValues: { token: initialToken },
    mode: 'onBlur',
  });

  async function onSubmit(values: VerifyEmailFormValues) {
    setFormError(null);
    try {
      await apiFetch<{ verified: true }>('/auth/verify-email', { method: 'POST', body: values });
      onSuccess();
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Section label="Verify email">
        <p className="text-small text-secondary-light">
          Account created for <span className="font-semibold">{subdomain}</span>. No email-sending is wired up yet
          (the backend&apos;s own DTO comment says this token is &quot;stubbed in MVP&quot;) — it&apos;s pre-filled
          below so you can continue; a real deployment would require checking your inbox instead.
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
