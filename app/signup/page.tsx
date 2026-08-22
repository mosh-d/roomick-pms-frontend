'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { RadioCard } from '@/components/ui/RadioCard';
import { apiFetch, ApiError } from '@/lib/api';
import { registerSchema, verifyEmailSchema, type RegisterFormValues, type VerifyEmailFormValues } from '@/lib/schemas/auth';

type RegisterResponse = { tenantId: string; userId: string; subdomain: string; verificationToken: string };
type SignupMode = 'demo' | 'real';

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
 *
 * Demo vs. real is the very first choice (see PHASE_NOTES.md) — a plain
 * inline RadioCard row (no `description` on either option), matching
 * every other top-level either/or choice in the reference. Choosing
 * "Try a demo" just tags the resulting tenant `isDemo: true`, which the
 * backend auto-expires in 30 days (or the owner can delete it early via
 * DELETE /tenants/me) — everything past this point is the identical form/
 * flow either way.
 *
 * `?demo=true`/`?demo=false` pre-selects the choice and skips straight to
 * the form — the landing page's two CTAs link here with it set, so a
 * visitor who already chose "Try a demo" there doesn't have to choose
 * again. `useSearchParams()` requires a Suspense boundary in the App
 * Router (reading it opts the route out of static rendering), hence the
 * default export below just wraps the real page in one.
 */
function SignupPageInner() {
  const searchParams = useSearchParams();
  const demoParam = searchParams.get('demo');
  const initialMode: SignupMode | null = demoParam === 'true' ? 'demo' : demoParam === 'false' ? 'real' : null;

  const [mode, setMode] = useState<SignupMode | null>(initialMode);
  const [step, setStep] = useState<'register' | 'verify' | 'done'>('register');
  const [registered, setRegistered] = useState<RegisterResponse | null>(null);

  return (
    <Container className="max-w-xl py-16">
      <h1 className="text-title font-bold text-secondary mb-2">Create your Roomick account</h1>
      <p className="text-body text-secondary-light mb-8">
        {mode === null && 'Try it out risk-free, or get started for real — same setup either way.'}
        {mode !== null && step === 'register' && 'Set up your organization and owner account.'}
        {step === 'verify' && 'Confirm your email to finish setting up your account.'}
        {step === 'done' && "You're verified — onboarding continues in a later phase."}
      </p>

      {mode === null ? (
        <RadioCard
          name="signupMode"
          tone="secondary"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'demo', title: 'Try a demo' },
            { value: 'real', title: 'Get started' },
          ]}
        />
      ) : null}

      {mode !== null && step === 'register' ? (
        <RegisterForm
          isDemo={mode === 'demo'}
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

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupPageInner />
    </Suspense>
  );
}

function RegisterForm({ isDemo, onSuccess }: { isDemo: boolean; onSuccess: (result: RegisterResponse) => void }) {
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
        body: { ...values, phone: values.phone || undefined, isDemo },
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
      {isDemo ? (
        <p className="text-small text-secondary-light">
          Demo mode — this organization auto-deletes 30 days from creation, or you can delete it yourself at any
          time from account settings.
        </p>
      ) : null}
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
