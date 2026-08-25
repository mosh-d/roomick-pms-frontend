'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
 * of that pair, not a new idea. Plain email+password — no subdomain field;
 * `User.email` is globally unique now (see `loginSchema`'s own comment),
 * so email alone resolves the account.
 *
 * Just the credentials form plus a redirect — `/dashboard` is real now and
 * owns everything past sign-in (branch resolution/picker, the shared
 * shell, "Signed in as X"). This page used to render that placeholder
 * itself (and an inline `BranchPicker`) before `/dashboard` existed; both
 * moved to `app/dashboard/layout.tsx`, which is also where a *returning*
 * signed-in visitor's `useEffect` below sends them.
 */
export default function LoginPage() {
  const router = useRouter();
  // See useHasHydrated.ts — without this, a reload with an existing
  // persisted session briefly renders the login form (the store's
  // un-hydrated `user: null`) before the redirect below has a chance to run.
  const authHydrated = useHasHydrated(useAuthStore);
  const login = useAuthStore((state) => state.login);
  const user = useAuthStore((state) => state.user);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema), mode: 'onTouched' });

  useEffect(() => {
    if (authHydrated && user) router.replace('/dashboard');
  }, [authHydrated, user, router]);

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    try {
      await login(values.email, values.password);
      router.replace('/dashboard');
    } catch (error) {
      if (error instanceof ApiError && error.isCode('EMAIL_NOT_VERIFIED')) {
        setFormError('Verify your email before logging in.');
        return;
      }
      if (error instanceof ApiError && error.isCode('INVALID_CREDENTIALS')) {
        setFormError('Email or password is incorrect.');
        return;
      }
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  // Also covers the moment right after a successful login, before the
  // effect above has run — no point flashing the form again.
  if (!authHydrated || user) return null;

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
