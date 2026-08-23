'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api';
import { loginSchema, type LoginFormValues } from '@/lib/schemas/auth';
import { useAuthStore } from '@/lib/store/authStore';
import { useHasHydrated } from '@/lib/useHasHydrated';

/**
 * Standalone login for a returning visit — the reference's Owner Account
 * Form lists "Link: Already have an account?" as a UI component (see
 * RegisterForm, which now links here), so this was always the other half
 * of that pair, not a new idea.
 *
 * On success there's deliberately nowhere real to send anyone yet — no
 * dashboard/front-desk UI exists past `/signup` (see PHASE_NOTES.md) — so
 * this just confirms the sign-in worked and shows who's logged in, the
 * same "next phase" placeholder pattern the signup wizard's `complete` step
 * already uses. `useAuthStore().login()` is the same action `AutoLoginStep`
 * uses inside the wizard; this page is the manual entry point to it.
 */
export default function LoginPage() {
  // See useHasHydrated.ts — without this, a reload with an existing
  // persisted session briefly renders the login form (the store's
  // un-hydrated `user: null`) before snapping to "Signed in as...".
  const authHydrated = useHasHydrated(useAuthStore);
  const login = useAuthStore((state) => state.login);
  const user = useAuthStore((state) => state.user);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema), mode: 'onTouched' });

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    try {
      await login(values.email, values.password, values.subdomain);
    } catch (error) {
      if (error instanceof ApiError && error.isCode('EMAIL_NOT_VERIFIED')) {
        setFormError('Verify your email before logging in.');
        return;
      }
      if (error instanceof ApiError && error.isCode('INVALID_CREDENTIALS')) {
        setFormError('Email, password, or subdomain is incorrect.');
        return;
      }
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  if (!authHydrated) return null;

  if (user) {
    return (
      <Container className="max-w-xl py-16">
        <h1 className="text-title font-bold text-secondary mb-2">Welcome back</h1>
        <Section label="Signed in">
          <p className="text-body text-secondary">
            Signed in as <span className="font-semibold">{user.name}</span> ({user.email}). A front-desk/operations
            dashboard is the next phase of this project — see <code className="text-tiny">PHASE_NOTES.md</code>.
          </p>
        </Section>
      </Container>
    );
  }

  return (
    <Container className="max-w-xl py-16">
      <h1 className="text-title font-bold text-secondary mb-2">Log in to Roomick</h1>
      <p className="text-body text-secondary-light mb-8">Enter your account details to continue.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Section label="Account">
          <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
          <Input
            label="Password"
            type="password"
            autoComplete="current-password"
            {...register('password')}
            error={errors.password?.message}
          />
          <Input
            label="Subdomain"
            hint="The unique id you picked at signup (e.g. acme)"
            {...register('subdomain')}
            error={errors.subdomain?.message}
          />
        </Section>

        {formError ? <p className="text-small text-red-600">{formError}</p> : null}

        <Button type="submit" loading={isSubmitting}>
          Log in
        </Button>
      </form>

      <p className="text-small text-secondary-light mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-primary-text font-semibold hover:underline">
          Sign up
        </Link>
      </p>
    </Container>
  );
}
