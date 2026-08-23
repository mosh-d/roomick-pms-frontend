'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { apiFetch, ApiError } from '@/lib/api';
import { loginSchema, type LoginFormValues } from '@/lib/schemas/auth';
import { useAuthStore } from '@/lib/store/authStore';
import { useHasHydrated } from '@/lib/useHasHydrated';
import { getDistinctBranchIds } from '@/lib/branches';
import { BranchPicker } from './_components/BranchPicker';

/**
 * Standalone login for a returning visit — the reference's Owner Account
 * Form lists "Link: Already have an account?" as a UI component (see
 * RegisterForm, which now links here), so this was always the other half
 * of that pair, not a new idea. Plain email+password — no subdomain field;
 * `User.email` is globally unique now (see `loginSchema`'s own comment),
 * so email alone resolves the account.
 *
 * On success there's deliberately nowhere real to send anyone yet — no
 * dashboard/front-desk UI exists past `/signup` (see PHASE_NOTES.md) — so
 * this just confirms the sign-in worked and shows who's logged in, the
 * same "next phase" placeholder pattern the signup wizard's `complete` step
 * already uses. `useAuthStore().login()` is the same action `AutoLoginStep`
 * uses inside the wizard; this page is the manual entry point to it.
 *
 * One real addition on top of that placeholder: if the account has roles
 * on more than one branch, `BranchPicker` shows first (Cloudbeds-style
 * property picker) — `activeBranchId` has nowhere real to route to either,
 * same honest scope boundary as the rest of this page, but it's real,
 * working state (persisted in `authStore`), not a mockup. `AutoLoginStep`
 * (the signup wizard's own auto-login) never reaches this: a freshly
 * registered owner always has exactly one role (`owner`, `branchId: null`),
 * so the picker is only reachable from a returning-staff login here.
 */
export default function LoginPage() {
  // See useHasHydrated.ts — without this, a reload with an existing
  // persisted session briefly renders the login form (the store's
  // un-hydrated `user: null`) before snapping to "Signed in as...".
  const authHydrated = useHasHydrated(useAuthStore);
  const login = useAuthStore((state) => state.login);
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
  const setActiveBranchId = useAuthStore((state) => state.setActiveBranchId);
  const [activeBranchName, setActiveBranchName] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // `activeBranchName` is local, render-only state — `activeBranchId` is
  // the one that's actually persisted (authStore, localStorage). A reload
  // after picking a branch keeps the id but loses the name, which would
  // otherwise silently regress the placeholder text back to not naming a
  // branch even though a real pick still stands — resolved here by
  // re-fetching and matching, not left as a known gap.
  useEffect(() => {
    if (!user || !activeBranchId || activeBranchName) return;
    let cancelled = false;
    apiFetch<Array<{ id: string; name: string }>>('/auth/me/branches', {
      accessToken: accessToken ?? undefined,
      tenantId: user.tenantId,
    })
      .then((branches) => {
        const match = branches.find((b) => b.id === activeBranchId);
        if (!cancelled && match) setActiveBranchName(match.name);
      })
      .catch(() => {
        // Best-effort only — worst case the placeholder just doesn't name
        // the branch, which isn't worth a user-facing error over.
      });
    return () => {
      cancelled = true;
    };
  }, [user, activeBranchId, activeBranchName, accessToken]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema), mode: 'onTouched' });

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    try {
      await login(values.email, values.password);
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

  if (!authHydrated) return null;

  if (user) {
    const distinctBranchIds = getDistinctBranchIds(user.roles);
    if (distinctBranchIds.length > 1 && !activeBranchId) {
      return (
        <BranchPicker
          accessToken={accessToken!}
          tenantId={user.tenantId}
          onSelect={(branchId, branchName) => {
            setActiveBranchId(branchId);
            setActiveBranchName(branchName);
          }}
        />
      );
    }

    return (
      <Container className="max-w-xl py-16">
        <h1 className="text-title font-bold text-secondary mb-2">Welcome back</h1>
        <Section label="Signed in">
          <p className="text-body text-secondary">
            Signed in as <span className="font-semibold">{user.name}</span> ({user.email})
            {activeBranchName ? (
              <>
                {' '}
                — working at <span className="font-semibold">{activeBranchName}</span>
              </>
            ) : null}
            . A front-desk/operations dashboard is the next phase of this project — see{' '}
            <code className="text-tiny">PHASE_NOTES.md</code>.
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
