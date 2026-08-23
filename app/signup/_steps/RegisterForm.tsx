'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { apiFetch, ApiError } from '@/lib/api';
import { registerSchema, type RegisterFormValues } from '@/lib/schemas/auth';
import { COUNTRIES } from '@/lib/countries';
import { callingCodeFor, displayFromE164, formatPhoneAsYouType, formatPhoneDisplay } from '@/lib/phone';
import { useWizardStore, type OwnerAccountDraft } from '@/lib/store/wizardStore';
import { useAuthStore } from '@/lib/store/authStore';
import { useAutosaveDraft } from '@/lib/useAutosaveDraft';
import { resumeOnboardingDraft } from '@/lib/resumeOnboarding';

/**
 * Step 1 of the onboarding wizard (Roomick-UI.pdf "Owner Account Form") —
 * three-row field layout (First/Last Name, Email/Country, Phone/Password)
 * matching the reference exactly, now that `country` is a real
 * `RegisterDto` field (see PHASE_NOTES.md — added specifically so the
 * backend can track which countries are onboarding from, reporting only
 * for now).
 *
 * The reference's Step 1 has no Group/Hotel Name field either — it only
 * appears here (in an "Organization" section below Owner Account) because
 * `POST /auth/register` genuinely requires it in the same call to create
 * the tenant; there's no later point in the flow where it could be
 * collected instead without restructuring the backend's registration
 * sequence. No Subdomain field at all anymore — login is plain
 * email+password now (see `lib/schemas/auth.ts`'s `loginSchema`), so
 * there's nothing left for a user-typed subdomain to disambiguate;
 * `Tenant.subdomain` still exists as an internal DB column, generated
 * server-side from the group name, never shown or asked for here.
 *
 * Unlike every step after email verification, this one still submits
 * immediately (see wizardStore.ts's header comment on why account creation
 * can't be deferred). That means navigating *back* here after the account
 * already exists needs different handling than "just show the form again"
 * — re-submitting the same email a second time doesn't create a second
 * account, it fails with EMAIL_TAKEN, which is exactly the "stuck" bug
 * this read-only mode exists to fix. Once `accountCreated` is true, the
 * fields render read-only with the values that were actually submitted,
 * and "Continue" just navigates forward — no form, no re-submit, nothing
 * to get stuck on.
 *
 * `onNext` also hands back the raw email/password the owner just typed —
 * not stored anywhere past this step (not even in wizardStore's persisted
 * draft — see that file's header comment on why), just threaded forward in
 * memory so `AutoLoginStep` can log the owner in immediately after email
 * verification (register/verify-email issue no access token; see that
 * step's comment).
 */
export function RegisterForm({
  isDemo,
  onNext,
}: {
  isDemo: boolean;
  onNext: (credentials: { email: string; password: string }) => void;
}) {
  const owner = useWizardStore((state) => state.owner);
  const accountCreated = useWizardStore((state) => state.accountCreated);
  const registerDraft = useWizardStore((state) => state.registerDraft);
  const patch = useWizardStore((state) => state.patch);

  if (accountCreated && owner) {
    return <AlreadyRegistered owner={owner} onNext={() => onNext({ email: owner.email, password: '' })} />;
  }

  return <RegisterFields isDemo={isDemo} onNext={onNext} patch={patch} registerDraft={registerDraft} />;
}

/**
 * Shown once the account already exists (navigated back from a later
 * step). No password to show or re-collect — `onNext` passes an empty one
 * up, which `AutoLoginStep` treats as "no credentials available, fall back
 * to prompting a real login" (see that file). Revisiting this step after
 * the account already exists is a pure "go look, then continue" action,
 * not a re-edit — changing any of these values for real would need a
 * backend update endpoint that doesn't exist yet (see PHASE_NOTES.md).
 */
function AlreadyRegistered({
  owner,
  onNext,
}: {
  owner: NonNullable<ReturnType<typeof useWizardStore.getState>['owner']>;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <Section label="Owner account">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Input label="First Name" value={owner.firstName} readOnly />
          <Input label="Last Name" value={owner.lastName} readOnly />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Input label="Email" value={owner.email} readOnly />
          <Input label="Country" value={owner.country ?? ''} readOnly />
        </div>
        <Input label="Phone" value={owner.phone ? formatPhoneDisplay(owner.phone) : ''} readOnly />
      </Section>

      <Section label="Organization">
        <Input label="Group / Hotel Name" value={owner.groupName} readOnly />
      </Section>

      <p className="text-small text-secondary-light">Your account already exists — nothing to re-submit here.</p>

      <Button type="button" onClick={onNext}>
        Continue
      </Button>
    </div>
  );
}

/** Strips `password` before writing a live draft to wizardStore — never persisted, not even transiently (see wizardStore.ts's header comment). */
function stripPassword(values: RegisterFormValues): OwnerAccountDraft {
  return {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    phone: values.phone,
    country: values.country,
    groupName: values.groupName,
  };
}

function RegisterFields({
  isDemo,
  onNext,
  patch,
  registerDraft,
}: {
  isDemo: boolean;
  onNext: (credentials: { email: string; password: string }) => void;
  patch: ReturnType<typeof useWizardStore.getState>['patch'];
  registerDraft: OwnerAccountDraft | null;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  // Set when register() fails because this exact account already exists
  // (EMAIL_TAKEN) — holds what's needed to offer "log in and continue
  // where you left off" instead of a dead-end field error. Cleared on the
  // next real edit so a stale offer can't outlive the values it was
  // computed from.
  const [conflict, setConflict] = useState<{ email: string; password: string } | null>(null);
  const [resuming, setResuming] = useState(false);
  const authLogin = useAuthStore((state) => state.login);
  const [phoneDisplay, setPhoneDisplay] = useState(() =>
    registerDraft?.phone ? displayFromE164(registerDraft.phone, registerDraft.country) : '',
  );
  const {
    register,
    handleSubmit,
    setError,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onTouched',
    defaultValues: registerDraft ?? undefined,
  });

  // See useAutosaveDraft.ts — a reload while still typing here (before
  // "Create account" is clicked) used to lose everything typed so far,
  // same gap every later step had. Password is deliberately excluded.
  useAutosaveDraft(watch, (values) => patch({ registerDraft: stripPassword(values) }));

  const country = watch('country');

  async function onSubmit(values: RegisterFormValues) {
    setFormError(null);
    setConflict(null);
    try {
      const result = await apiFetch<{ tenantId: string; userId: string; subdomain: string; verificationToken: string }>(
        '/auth/register',
        {
          method: 'POST',
          body: {
            groupName: values.groupName,
            name: `${values.firstName} ${values.lastName}`.trim(),
            email: values.email,
            password: values.password,
            phone: values.phone || undefined,
            country: values.country || undefined,
            isDemo,
          },
        },
      );
      patch({
        owner: {
          firstName: values.firstName,
          lastName: values.lastName,
          email: values.email,
          phone: values.phone,
          country: values.country,
          groupName: values.groupName,
        },
        accountCreated: true,
        verificationToken: result.verificationToken,
        registerDraft: null,
      });
      onNext({ email: values.email, password: values.password });
    } catch (error) {
      if (error instanceof ApiError && error.isCode('EMAIL_TAKEN')) {
        setError('email', { message: error.message });
        setConflict({ email: values.email, password: values.password });
        return;
      }
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  /**
   * "This email already belongs to a real account" isn't necessarily a
   * mistake — it's what happens every time this exact owner comes back to
   * a signup link after already registering (a fresh browser session has
   * no local record `accountCreated` was ever true). Logging in *is* the
   * "do these details actually match that account" check — a wrong
   * password fails here with the normal INVALID_CREDENTIALS message, same
   * as `/login` would show, so this can't be used to confirm someone
   * else's account exists. Once logged in, `resumeOnboardingDraft` reads
   * how far onboarding actually got on the backend and rehydrates
   * wizardStore to match — no `onNext()` here, since the wizard's `step`
   * (set by that patch) is what actually drives which screen page.tsx
   * renders next, and it's rarely "verify email" from this path.
   */
  async function handleResume() {
    if (!conflict) return;
    setFormError(null);
    setResuming(true);
    try {
      const login = await authLogin(conflict.email, conflict.password);
      const resumePatch = await resumeOnboardingDraft(login.accessToken, login.user);
      patch(resumePatch);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Could not log in with these details.');
    } finally {
      setResuming(false);
    }
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {isDemo ? (
          <p className="text-small text-secondary-light">
            Demo mode — this organization auto-deletes 30 days from creation, or you can delete it yourself at any
            time from account settings.
          </p>
        ) : null}
        <Section label="Owner account">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Input label="First Name" autoComplete="given-name" {...register('firstName')} error={errors.firstName?.message} />
            <Input label="Last Name" autoComplete="family-name" {...register('lastName')} error={errors.lastName?.message} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Input label="Email" type="email" autoComplete="email" {...register('email')} error={errors.email?.message} />
            <Controller
              control={control}
              name="country"
              render={({ field }) => (
                <Select
                  name="country"
                  label="Country"
                  options={COUNTRIES}
                  value={field.value || null}
                  onChange={field.onChange}
                  error={errors.country?.message}
                />
              )}
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Controller
              control={control}
              name="phone"
              render={({ field }) => (
                <Input
                  label="Phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  prefix={callingCodeFor(country) ?? undefined}
                  hint={callingCodeFor(country) ? undefined : 'Pick a country above for a calling-code prefix'}
                  value={phoneDisplay}
                  onChange={(event) => {
                    const { display, e164 } = formatPhoneAsYouType(event.target.value, country);
                    setPhoneDisplay(display);
                    field.onChange(e164);
                  }}
                  onBlur={(event) => {
                    // Re-normalizes from whatever the DOM actually shows,
                    // not just the last onChange — the safety net an
                    // autofilled value needs (a browser can set an
                    // autofilled `<input>`'s value in a way that doesn't
                    // reliably fire React's onChange, leaving the raw
                    // autofilled text, leading trunk "0" included, on
                    // screen with none of the live formatting applied).
                    const { display, e164 } = formatPhoneAsYouType(event.target.value, country);
                    setPhoneDisplay(display);
                    field.onChange(e164);
                    field.onBlur();
                  }}
                  error={errors.phone?.message}
                />
              )}
            />
            <Input
              label="Password"
              type="password"
              autoComplete="new-password"
              hint="At least 8 characters, with an uppercase letter, a lowercase letter, and a number"
              {...register('password')}
              error={errors.password?.message}
            />
          </div>
        </Section>

        <Section label="Organization">
          <Input
            label="Group / Hotel Name"
            autoComplete="organization"
            {...register('groupName')}
            error={errors.groupName?.message}
          />
        </Section>

        {formError ? <p className="text-small text-red-600">{formError}</p> : null}

        {conflict ? (
          <div className="flex flex-col gap-2 rounded-control bg-secondary-light/15 px-3 py-2">
            <p className="text-small text-secondary">
              An account already exists with these details — if that&apos;s you, log in and continue setting it up
              instead of creating a new one.
            </p>
            <Button type="button" variant="secondary" loading={resuming} onClick={handleResume}>
              Log in and continue where I left off
            </Button>
          </div>
        ) : null}

        <Button type="submit" loading={isSubmitting}>
          Create account
        </Button>
      </form>

      <p className="text-small text-secondary-light mt-4">
        Already have an account?{' '}
        <Link href="/login" className="text-primary-text font-semibold hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
