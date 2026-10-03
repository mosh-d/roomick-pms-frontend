'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import QRCode from 'qrcode';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { ApiError } from '@/lib/api';
import {
  useBeginMfaSetupMutation,
  useDisableMfaMutation,
  useEnableMfaMutation,
  useMfaStatusQuery,
  useRegenerateRecoveryCodesMutation,
  type MfaSetup,
  type MfaStatus,
} from '@/lib/mfa';
import { useAuthStore } from '@/lib/store/authStore';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };
type Message = { kind: 'ok' | 'error'; text: string } | null;

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

/**
 * The signed-in person's own account: who they are, and their two-step
 * sign-in. Everyone can reach it — it's about the person, not the property.
 */
export default function AccountPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  return (
    <Container className="max-w-3xl py-10 flex flex-col gap-8">
      <PageHeader title="My Account" subtitle="Your sign-in details and two-step sign-in." />
      <Section label="You">
        <Card className="flex flex-col gap-1 text-body text-secondary">
          <p className="font-semibold">{user?.name}</p>
          <p className="text-small text-secondary/80">{user?.email}</p>
        </Card>
      </Section>
      {/* useSearchParams needs a Suspense boundary under the App Router. */}
      <Suspense fallback={null}>
        <RecoveryNotice />
      </Suspense>
      <TwoStepSection auth={auth} />
    </Container>
  );
}

/** Shown after signing in with a recovery code — the login page sends people here with how many are left. */
function RecoveryNotice() {
  const params = useSearchParams();
  const left = params.get('recoveryUsed');
  if (left === null) return null;
  const count = Number(left);
  return (
    <Card tone="accent" className="flex flex-col gap-1">
      <p className="text-small font-semibold text-primary-dark" id="recovery-used-notice">
        You signed in with a recovery code. {count} {count === 1 ? 'is' : 'are'} left.
      </p>
      <p className="text-small text-primary-dark/80">
        {count <= 3 ? 'That’s running low — make a new set below and keep it somewhere safe. ' : ''}If your phone is lost, set two-step sign-in up again on your new phone.
      </p>
    </Card>
  );
}

function TwoStepSection({ auth }: { auth: AuthOpts }) {
  const status = useMfaStatusQuery(auth);
  const [codes, setCodes] = useState<string[] | null>(null);

  return (
    <Section label="Two-step sign-in">
      <Card className="flex flex-col gap-4">
        <p className="text-small text-secondary">
          After your password, Roomick also asks for a code from an authenticator app on your phone — Google Authenticator, Microsoft Authenticator, 1Password or
          any other. Someone who learns your password still can’t get in.
        </p>
        {status.isError ? (
          <p className="text-small text-red-600">{errorText(status.error, 'Couldn’t load your sign-in settings.')}</p>
        ) : !status.data ? (
          <p className="text-small text-secondary">Loading…</p>
        ) : codes ? (
          <RecoveryCodes codes={codes} onDone={() => setCodes(null)} />
        ) : status.data.enabled ? (
          <EnabledPanel status={status.data} auth={auth} onNewCodes={setCodes} />
        ) : (
          <SetupPanel auth={auth} onEnabled={setCodes} />
        )}
      </Card>
    </Section>
  );
}

function SetupPanel({ auth, onEnabled }: { auth: AuthOpts; onEnabled: (codes: string[]) => void }) {
  const begin = useBeginMfaSetupMutation(auth);
  const enable = useEnableMfaMutation(auth);
  const [setup, setSetup] = useState<MfaSetup | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<Message>(null);

  // The QR is drawn in the browser from the setup link, so the secret never
  // travels anywhere it doesn't already have to.
  useEffect(() => {
    if (!setup) return;
    let cancelled = false;
    QRCode.toDataURL(setup.otpauthUri, { margin: 1, width: 208 })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => {
        if (!cancelled) setQr(null);
      });
    return () => {
      cancelled = true;
    };
  }, [setup]);

  function start() {
    setMessage(null);
    setQr(null);
    begin.mutate(undefined, {
      onSuccess: setSetup,
      onError: (err) => setMessage({ kind: 'error', text: errorText(err, 'Couldn’t start setup.') }),
    });
  }

  function confirm() {
    setMessage(null);
    enable.mutate(code.replace(/\s/g, ''), {
      onSuccess: (result) => onEnabled(result.recoveryCodes),
      onError: (err) => setMessage({ kind: 'error', text: errorText(err, 'Couldn’t switch it on.') }),
    });
  }

  if (!setup) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-small text-secondary" id="mfa-state">
          <span className="font-semibold">Off.</span> Signing in needs only your password.
        </p>
        <div>
          <Button type="button" onClick={start} loading={begin.isPending}>
            Set Up Two-Step Sign-In
          </Button>
        </div>
        {message ? <p className="text-small text-red-600">{message.text}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ol className="list-decimal pl-5 text-small text-secondary flex flex-col gap-1">
        <li>Open your authenticator app and add an account.</li>
        <li>Scan this code — or type the key below if you can’t scan.</li>
        <li>Enter the six-digit code the app shows to finish.</li>
      </ol>
      <div className="flex flex-wrap items-start gap-6">
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data: URL drawn in the browser; next/image adds nothing here
          <img src={qr} alt="QR code to add Roomick to an authenticator app" width={208} height={208} className="rounded-control border border-secondary/20 bg-white" id="mfa-qr" />
        ) : (
          <div className="size-52 rounded-control border border-secondary/20 bg-secondary/5" aria-hidden="true" />
        )}
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-tiny text-secondary/70">Key (time-based)</p>
          <code className="text-small font-mono tracking-wider break-all text-secondary" id="mfa-secret">
            {setup.secret.match(/.{1,4}/g)?.join(' ')}
          </code>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[12rem_max-content] gap-3 items-end">
        <Input
          id="mfa-setup-code"
          label="Code from the app"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          placeholder="123456"
        />
        <Button type="button" className="mb-2" onClick={confirm} loading={enable.isPending} disabled={!/^\d{6}$/.test(code.replace(/\s/g, ''))}>
          Turn On
        </Button>
      </div>
      {message ? <p className="text-small text-red-600">{message.text}</p> : null}
    </div>
  );
}

function EnabledPanel({ status, auth, onNewCodes }: { status: MfaStatus; auth: AuthOpts; onNewCodes: (codes: string[]) => void }) {
  const regenerate = useRegenerateRecoveryCodesMutation(auth);
  const disable = useDisableMfaMutation(auth);
  const [action, setAction] = useState<'codes' | 'off' | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<Message>(null);

  function reset(next: 'codes' | 'off' | null) {
    setAction(next);
    setCode('');
    setPassword('');
    setMessage(null);
  }

  function submit() {
    setMessage(null);
    if (action === 'codes') {
      regenerate.mutate(code, {
        onSuccess: (result) => onNewCodes(result.recoveryCodes),
        onError: (err) => setMessage({ kind: 'error', text: errorText(err, 'Couldn’t make new codes.') }),
      });
    } else if (action === 'off') {
      disable.mutate(
        { password, code },
        {
          onSuccess: () => reset(null),
          onError: (err) => setMessage({ kind: 'error', text: errorText(err, 'Couldn’t turn it off.') }),
        },
      );
    }
  }

  const since = status.enabledAt ? new Date(status.enabledAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-secondary" id="mfa-state">
        <span className="font-semibold text-green-700">On</span>
        {since ? ` since ${since}` : ''}. {status.recoveryCodesLeft} recovery {status.recoveryCodesLeft === 1 ? 'code' : 'codes'} left.
      </p>
      {status.recoveryCodesLeft <= 3 ? <p className="text-small text-amber-700">You’re running low on recovery codes — make a new set.</p> : null}

      {action === null ? (
        <div className="flex flex-wrap gap-3">
          <Button type="button" variant="outline" onClick={() => reset('codes')}>
            New Recovery Codes
          </Button>
          <Button type="button" variant="outline" onClick={() => reset('off')}>
            Turn Off
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3 border-t border-secondary/20 pt-3">
          <p className="text-small text-secondary">
            {action === 'codes'
              ? 'Enter a code from your app. Your old recovery codes stop working as soon as the new ones are made.'
              : 'Enter your password and a code from your app (or a recovery code) to turn two-step sign-in off.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {action === 'off' ? (
              <Input id="mfa-off-password" label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            ) : null}
            <Input id="mfa-action-code" label="Code" value={code} onChange={(e) => setCode(e.target.value)} autoComplete="one-time-code" maxLength={11} placeholder="123456" />
          </div>
          <div className="flex gap-3">
            <Button
              type="button"
              onClick={submit}
              loading={regenerate.isPending || disable.isPending}
              disabled={code.trim().length < 6 || (action === 'off' && password.length === 0)}
              variant={action === 'off' ? 'danger' : 'primary'}
            >
              {action === 'codes' ? 'Make New Codes' : 'Turn Off Two-Step Sign-In'}
            </Button>
            <Button type="button" variant="outline" onClick={() => reset(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {message ? (
        <p className={`text-small ${message.kind === 'error' ? 'text-red-600' : 'text-green-700'}`} id="mfa-message">
          {message.text}
        </p>
      ) : null}
    </div>
  );
}

/** Shown once, straight after they're made: each works one time, for signing in without the phone. */
function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false);
  const text = `Roomick recovery codes — each works once\n\n${codes.join('\n')}\n`;

  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'roomick-recovery-codes.txt';
    link.click();
    URL.revokeObjectURL(url);
    setSaved(true);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-small font-semibold text-green-700" id="mfa-state">
        Two-step sign-in is on.
      </p>
      <p className="text-small text-secondary">
        Save these recovery codes somewhere safe — not on your phone. If you lose your phone, each one gets you in once. They won’t be shown again.
      </p>
      <ul className="grid grid-cols-2 gap-x-6 gap-y-1 rounded-control border border-secondary/20 bg-secondary/5 p-4 font-mono text-small text-secondary w-fit" id="recovery-codes">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <Button type="button" variant="outline" onClick={download}>
          Download
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => setSaved(true));
          }}
        >
          Copy
        </Button>
        <Button type="button" onClick={onDone} disabled={!saved}>
          I’ve Saved Them
        </Button>
      </div>
      {!saved ? <p className="text-tiny text-secondary/70">Download or copy them first.</p> : null}
    </div>
  );
}
