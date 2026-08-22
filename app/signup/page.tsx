'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { apiFetch, ApiError } from '@/lib/api';
import { registerSchema, verifyEmailSchema, type RegisterFormValues, type VerifyEmailFormValues } from '@/lib/schemas/auth';

type RegisterResponse = { tenantId: string; userId: string; subdomain: string; verificationToken: string };

/**
 * Step 1 of the reference's onboarding wizard (Roomick-UI.pdf) — Owner
 * Account Form. Built against the real backend DTO
 * (roomick-pms-backend/src/modules/auth/dto/register.dto.ts), not the
 * reference doc's payload example — they disagree (see PHASE_NOTES.md):
 * the real endpoint needs `subdomain`/`groupName` up front in this one
 * call, and the response carries a `verificationToken`, never an access
 * token — nothing is usable until /auth/verify-email succeeds.
 *
 * Two-step flow, not a single page: register → verify email. The token is
 * a real stubbed JWT the backend hands back directly in the register
 * response (`token: string` with `@IsJWT()` — its own comment says
 * "stubbed in MVP"), since no email-sending infrastructure exists yet.
 * Pre-filling it here is a deliberate, visible dev convenience — not
 * something a production build should do once real email delivery lands.
 */
export default function SignupPage() {
  const [step, setStep] = useState<'register' | 'verify' | 'done'>('register');
  const [registered, setRegistered] = useState<RegisterResponse | null>(null);

  return (
    <Container className="max-w-xl py-16">
      <h1 className="text-title font-bold text-secondary mb-2">Create your Roomick account</h1>
      <p className="text-body text-secondary-light mb-8">
        {step === 'register' && 'Set up your organization and owner account.'}
        {step === 'verify' && 'Confirm your email to finish setting up your account.'}
        {step === 'done' && "You're verified — onboarding continues in a later phase."}
      </p>

      {step === 'register' ? (
        <RegisterForm
          onSuccess={(result) => {
            setRegistered(result);
            setStep('verify');
          }}
        />
      ) : null}

      {step === 'verify' && registered ? (
        <VerifyEmailForm subdomain={registered.subdomain} initialToken={registered.verificationToken} onSuccess={() => setStep('done')} />
      ) : null}

      {step === 'done' ? (
        <Section label="Account verified">
          <p className="text-body text-secondary">
            Owner account created for <span className="font-semibold">{registered?.subdomain}</span>. The rest of the
            onboarding wizard (Organization Structure → Branch Setup → Room Types → Review) is the next phase — see{' '}
            <code className="text-tiny">PHASE_NOTES.md</code>.
          </p>
        </Section>
      ) : null}
    </Container>
  );
}

function RegisterForm({ onSuccess }: { onSuccess: (result: RegisterResponse) => void }) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema) });

  async function onSubmit(values: RegisterFormValues) {
    setFormError(null);
    try {
      const result = await apiFetch<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: { ...values, phone: values.phone || undefined },
      });
      onSuccess(result);
    } catch (error) {
      if (error instanceof ApiError && error.isCode('SUBDOMAIN_TAKEN')) {
        setError('subdomain', { message: error.message });
        return;
      }
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Section label="Owner account">
        <Input label="Full Name" {...register('name')} error={errors.name?.message} />
        <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
        <Input
          label="Password"
          type="password"
          hint="At least 8 characters, with an uppercase letter, a lowercase letter, and a number"
          {...register('password')}
          error={errors.password?.message}
        />
        <Input label="Phone" {...register('phone')} error={errors.phone?.message} />
      </Section>

      <Section label="Organization">
        <Input label="Group / Hotel Name" {...register('groupName')} error={errors.groupName?.message} />
        <Input
          label="Subdomain"
          hint="Your account's address — e.g. acme → acme.roomick.com"
          {...register('subdomain')}
          error={errors.subdomain?.message}
        />
      </Section>

      {formError ? <p className="text-small text-red-600">{formError}</p> : null}

      <Button type="submit" loading={isSubmitting}>
        Create account
      </Button>
    </form>
  );
}

function VerifyEmailForm({
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
