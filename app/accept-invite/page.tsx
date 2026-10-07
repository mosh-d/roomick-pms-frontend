'use client';

import Link from 'next/link';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api';
import { acceptInvite, isInviteJoined, newPasswordSchema, previewInvite, type InvitePreview } from '@/lib/account';
import { roleLabel } from '@/lib/roles';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * Where a staff invitation's link lands. Someone new chooses their name and
 * a password and is signed straight in. Someone who already has a Roomick
 * account here (invited to another branch) gives that account's password —
 * the invitation adds the role, then they sign in as usual, two-step
 * sign-in included. An invitation is never a way into someone's account.
 */
export default function AcceptInvitePage() {
  return (
    <Suspense fallback={null}>
      <AcceptInvite />
    </Suspense>
  );
}

function AcceptInvite() {
  const token = useSearchParams().get('token') ?? '';
  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    previewInvite(token)
      .then((preview) => {
        if (!cancelled) setInvite(preview);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Couldn’t open this invitation. Check your connection and try again.');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loadError) {
    return (
      <Container className="max-w-xl py-16 flex flex-col gap-4">
        <h1 className="font-display text-title font-bold text-surface">This invitation can’t be used</h1>
        <p className="text-body text-surface" id="invite-error">
          {loadError}
        </p>
        <p className="text-small text-surface-muted">
          Already set up?{' '}
          <Link href="/login" className="text-surface-accent font-semibold hover:underline">
            Log in
          </Link>
        </p>
      </Container>
    );
  }

  if (!invite) return null;

  return (
    <Container className="max-w-xl py-16 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-title font-bold text-surface mb-2">Join {invite.organisation} on Roomick</h1>
        <p className="text-body text-surface-muted" id="invite-summary">
          You’re invited to work{invite.branch ? ` at ${invite.branch}` : ''} as {roleLabel(invite.role)}. The invitation is for{' '}
          <span className="font-semibold text-surface">{invite.email}</span> and works until{' '}
          {new Date(invite.expiresAt).toLocaleString(undefined, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}.
        </p>
      </div>
      {invite.existingAccount ? <ExistingAccountForm token={token} invite={invite} /> : <NewAccountForm token={token} invite={invite} />}
    </Container>
  );
}

function SignedInNote() {
  const user = useAuthStore((s) => s.user);
  if (!user) return null;
  return (
    <Card tone="accent">
      <p className="text-small text-surface">
        You’re signed in on this computer as {user.email}. Accepting signs you out of that account.
      </p>
    </Card>
  );
}

/** Someone new: their name, a password, and they're in. */
function NewAccountForm({ token, invite }: { token: string; invite: InvitePreview }) {
  const router = useRouter();
  const adoptSession = useAuthStore((s) => s.adoptSession);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ name?: string; password?: string; confirm?: string; form?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next: typeof errors = {};
    if (name.trim().length < 2) next.name = 'Enter your name';
    const strength = newPasswordSchema.safeParse(password);
    if (!strength.success) next.password = strength.error.issues[0]?.message;
    if (confirm !== password) next.confirm = 'The two passwords don’t match';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      const result = await acceptInvite(token, { name: name.trim(), password, phone: phone.trim() || undefined });
      if (isInviteJoined(result)) {
        router.replace('/login?joined=1');
        return;
      }
      adoptSession(result);
      router.replace('/dashboard');
    } catch (err) {
      setErrors({ form: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <SignedInNote />
      <Section label="Your account">
        <Input id="invite-email" label="Email" value={invite.email} readOnly hint="The address the invitation was sent to — you sign in with it." />
        <Input id="invite-name" label="Your name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <Input id="invite-phone" label="Phone (optional)" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        <Input
          id="invite-password"
          label="Choose a password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint="At least 8 characters, with an upper-case letter, a lower-case letter and a number."
        />
        <Input id="invite-confirm" label="Type it again" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} error={errors.confirm} />
      </Section>
      {errors.form ? (
        <p className="text-small text-red-600" id="invite-form-error">
          {errors.form}
        </p>
      ) : null}
      <Button type="submit" loading={submitting}>
        Create my account
      </Button>
    </form>
  );
}

/** Someone who already has an account here: its own password adds the role, then they sign in as usual. */
function ExistingAccountForm({ token, invite }: { token: string; invite: InvitePreview }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) return;
    setError(null);
    setSubmitting(true);
    try {
      await acceptInvite(token, { password });
      router.replace('/login?joined=1');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <SignedInNote />
      <Section label="Your account">
        <p className="text-small text-surface">
          {invite.email} already has a Roomick account here. Enter its password to add this role to it — then log in as usual.
        </p>
        <Input id="invite-existing-password" label="Your password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Section>
      {error ? (
        <p className="text-small text-red-600" id="invite-form-error">
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={submitting} disabled={!password}>
        Accept invitation
      </Button>
      <p className="text-small text-surface-muted">
        Forgotten it?{' '}
        <Link href="/forgot-password" className="text-surface-accent font-semibold hover:underline">
          Reset your password
        </Link>{' '}
        first, then open this link again.
      </p>
    </form>
  );
}
