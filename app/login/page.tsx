'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api';
import { resendVerification, verifyEmail } from '@/lib/account';
import { loginSchema, type LoginFormValues } from '@/lib/schemas/auth';
import { isMfaChallenge, useAuthStore } from '@/lib/store/authStore';
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
/**
 * Where to go once signed in: back to the page a session ended on (`?next=`,
 * set by the dashboard's auth gate), or the dashboard. Only ever a dashboard
 * path — never somewhere a crafted link could send a freshly signed-in user.
 * Read from `window.location` inside handlers and effects, so the page needs
 * no Suspense boundary for `useSearchParams`.
 */
/** What the page says when another page sent someone here to log in. */
const ARRIVAL_NOTICES: Record<string, string> = {
  reset: 'Your password is changed — log in with the new one.',
  joined: 'The invitation is accepted — log in to start.',
  verified: 'Your email is confirmed — log in to carry on.',
};

/**
 * From the search params, not `window.location`: after a client-side
 * redirect here the address bar can still show the previous page while this
 * one first renders. The one place on this page that needs Suspense.
 */
function ArrivalNotice() {
  const params = useSearchParams();
  const key = Object.keys(ARRIVAL_NOTICES).find((name) => params.get(name) === '1');
  if (!key) return null;
  return (
    <p className="text-small text-green-700" id="login-notice">
      {ARRIVAL_NOTICES[key]}
    </p>
  );
}

function afterSignIn(): string {
  const next = new URLSearchParams(window.location.search).get('next');
  return next && /^\/dashboard(\/|$|\?)/.test(next) && !next.startsWith('//') ? next : '/dashboard';
}

export default function LoginPage() {
  const router = useRouter();
  // See useHasHydrated.ts — without this, a reload with an existing
  // persisted session briefly renders the login form (the store's
  // un-hydrated `user: null`) before the redirect below has a chance to run.
  const authHydrated = useHasHydrated(useAuthStore);
  const login = useAuthStore((state) => state.login);
  const user = useAuthStore((state) => state.user);
  const sessionEnded = useAuthStore((state) => state.sessionEnded);
  const leaveEndedSession = useAuthStore((state) => state.leaveEndedSession);
  const [formError, setFormError] = useState<string | null>(null);
  // The email and password of a sign-in refused because the email isn't confirmed yet — what "Send the link again" uses.
  const [unconfirmed, setUnconfirmed] = useState<LoginFormValues | null>(null);
  // Set once the password is right on an account with two-step sign-in on.
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({ resolver: zodResolver(loginSchema), mode: 'onTouched' });

  useEffect(() => {
    if (!authHydrated || !user) return;
    // A session that ended while you were on another page (the signup
    // wizard, say) isn't one to be sent on with — forget it and sign in.
    if (sessionEnded) {
      void leaveEndedSession();
      return;
    }
    router.replace(afterSignIn());
  }, [authHydrated, user, router, sessionEnded, leaveEndedSession]);

  async function onSubmit(values: LoginFormValues) {
    setFormError(null);
    setUnconfirmed(null);
    try {
      const result = await login(values.email, values.password);
      if (isMfaChallenge(result)) {
        setChallengeToken(result.challengeToken);
        return;
      }
      router.replace(afterSignIn());
    } catch (error) {
      if (error instanceof ApiError && error.isCode('EMAIL_NOT_VERIFIED')) {
        setUnconfirmed(values);
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

  if (challengeToken) {
    return (
      <SecondStep
        challengeToken={challengeToken}
        onExpired={(message) => {
          setChallengeToken(null);
          setFormError(message);
        }}
      />
    );
  }

  return (
    <Container className="max-w-xl py-16">
      <h1 className="font-display text-title font-bold text-surface mb-2">Log in to Roomick</h1>
      <p className="text-body text-surface-muted mb-8">Enter your account details to continue.</p>

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

        {!formError && !unconfirmed ? (
          <Suspense fallback={null}>
            <ArrivalNotice />
          </Suspense>
        ) : null}
        {formError ? <p className="text-small text-red-600">{formError}</p> : null}
        {unconfirmed ? <UnconfirmedEmail values={unconfirmed} onConfirmed={() => onSubmit(unconfirmed)} /> : null}

        <Button type="submit" loading={isSubmitting}>
          Log in
        </Button>
        <Link href="/forgot-password" className="text-small text-surface-accent font-semibold hover:underline self-start" id="forgot-password-link">
          Forgot your password?
        </Link>
      </form>

      <p className="text-small text-surface-muted mt-6">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-surface-accent font-semibold hover:underline">
          Sign up
        </Link>
      </p>
    </Container>
  );
}

/**
 * A right password on an account whose email isn't confirmed yet. With email
 * set up, a new link is sent; without, the password just typed gets the
 * confirmation straight away — the same shortcut sign-up uses — and the
 * sign-in carries on.
 */
function UnconfirmedEmail({ values, onConfirmed }: { values: LoginFormValues; onConfirmed: () => Promise<void> }) {
  const [state, setState] = useState<'idle' | 'working' | 'sent' | { error: string }>('idle');

  async function sendAgain() {
    setState('working');
    try {
      const result = await resendVerification(values.email, values.password);
      if (result.emailEnabled) {
        setState('sent');
        return;
      }
      if (!result.verificationToken) {
        setState({ error: 'Couldn’t confirm it — check the password and try again.' });
        return;
      }
      await verifyEmail(result.verificationToken);
      await onConfirmed();
    } catch (err) {
      setState({ error: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-primary/30 p-3" id="email-not-confirmed">
      <p className="text-small text-surface">
        <span className="font-semibold">Confirm your email first.</span> We sent a link to {values.email} when you signed up.
      </p>
      {state === 'sent' ? (
        <p className="text-small text-green-700">Sent — open the new link in that email, then log in. Look in your spam folder too.</p>
      ) : (
        <Button type="button" size="sm" variant="outline" className="self-start" onClick={sendAgain} loading={state === 'working'}>
          Send the link again
        </Button>
      )}
      {typeof state === 'object' ? <p className="text-small text-red-600">{state.error}</p> : null}
    </div>
  );
}

/**
 * The code half of a two-step sign-in. A recovery code works here too, for
 * when the phone isn't to hand; signing in with one goes to My Account
 * afterwards, which says how many are left.
 */
function SecondStep({ challengeToken, onExpired }: { challengeToken: string; onExpired: (message: string) => void }) {
  const router = useRouter();
  const verifyMfa = useAuthStore((state) => state.verifyMfa);
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const ready = useRecovery ? code.replace(/[\s-]/g, '').length === 10 : /^\d{6}$/.test(code.replace(/\s/g, ''));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    setError(null);
    setSubmitting(true);
    try {
      const result = await verifyMfa(challengeToken, code);
      router.replace(result.secondFactor === 'recovery' ? `/dashboard/account?recoveryUsed=${result.recoveryCodesLeft}` : afterSignIn());
    } catch (err) {
      if (err instanceof ApiError && err.isCode('TOKEN_INVALID')) {
        onExpired(err.message);
        return;
      }
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setCode('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Container className="max-w-xl py-16">
      <h1 className="font-display text-title font-bold text-surface mb-2">Two-step sign-in</h1>
      <p className="text-body text-surface-muted mb-8">
        {useRecovery ? 'Enter one of the recovery codes you saved when you set this up. Each one works once.' : 'Enter the 6-digit code from your authenticator app.'}
      </p>

      <form onSubmit={submit} className="flex flex-col gap-4">
        <Section label="Verification">
          <Input
            id="mfa-code"
            label={useRecovery ? 'Recovery code' : 'Code'}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode={useRecovery ? 'text' : 'numeric'}
            autoComplete="one-time-code"
            autoFocus
            maxLength={useRecovery ? 11 : 7}
            placeholder={useRecovery ? 'xxxxx-xxxxx' : '123456'}
          />
        </Section>

        {error ? (
          <p id="mfa-error" className="text-small text-red-600">
            {error}
          </p>
        ) : null}

        <Button type="submit" loading={submitting} disabled={!ready}>
          Verify
        </Button>
      </form>

      <div className="flex flex-wrap gap-4 mt-6 text-small">
        <button
          type="button"
          className="text-surface-accent font-semibold hover:underline"
          onClick={() => {
            setUseRecovery((current) => !current);
            setCode('');
            setError(null);
          }}
        >
          {useRecovery ? 'Use my authenticator app instead' : 'Use a recovery code instead'}
        </button>
        <button type="button" className="text-surface-muted hover:underline" onClick={() => onExpired('')}>
          Start again
        </button>
      </div>
    </Container>
  );
}
