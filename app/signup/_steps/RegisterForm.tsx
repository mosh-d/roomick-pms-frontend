'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { apiFetch, ApiError } from '@/lib/api';
import { registerSchema, type RegisterFormValues } from '@/lib/schemas/auth';
import { COUNTRIES } from '@/lib/countries';
import { slugify } from '@/lib/slug';
import { useWizardStore } from '@/lib/store/wizardStore';

/**
 * Step 1 of the onboarding wizard (Roomick-UI.pdf "Owner Account Form") —
 * three-row field layout (First/Last Name, Email/Country, Phone/Password)
 * matching the reference exactly, now that `country` is a real
 * `RegisterDto` field (see PHASE_NOTES.md — added specifically so the
 * backend can track which countries are onboarding from, reporting only
 * for now).
 *
 * The reference's Step 1 has no Group/Hotel Name or Subdomain field —
 * those only appear here (in an "Organization" section below Owner
 * Account) because `POST /auth/register` genuinely requires both in the
 * same call to create the tenant; there's no later point in the flow where
 * they could be collected instead without restructuring the backend's
 * registration sequence. Subdomain is auto-suggested from Group/Hotel Name
 * as the owner types (slugified live, see the `useEffect` below) rather
 * than asked for cold — still editable, and stops auto-following the
 * moment the owner touches it themselves (a `subdomainEdited` flag, not a
 * one-time default), so a `SUBDOMAIN_TAKEN` conflict is still recoverable
 * by hand.
 *
 * Unlike every step after email verification, this one still submits
 * immediately (see wizardStore.ts's header comment on why account creation
 * can't be deferred). That means navigating *back* here after the account
 * already exists needs different handling than "just show the form again"
 * — re-submitting the same subdomain/email a second time doesn't create a
 * second account, it fails with SUBDOMAIN_TAKEN/EMAIL_TAKEN, which is
 * exactly the "stuck" bug this read-only mode exists to fix. Once
 * `accountCreated` is true, the fields render read-only with the values
 * that were actually submitted, and "Continue" just navigates forward —
 * no form, no re-submit, nothing to get stuck on.
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
  const patch = useWizardStore((state) => state.patch);

  if (accountCreated && owner) {
    return <AlreadyRegistered owner={owner} onNext={() => onNext({ email: owner.email, password: '' })} />;
  }

  return <RegisterFields isDemo={isDemo} onNext={onNext} patch={patch} />;
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
        <Input label="Phone" value={owner.phone ?? ''} readOnly />
      </Section>

      <Section label="Organization">
        <Input label="Group / Hotel Name" value={owner.groupName} readOnly />
        <Input
          label="Subdomain"
          hint="Already created — changing your account's login id isn't supported yet."
          value={owner.subdomain}
          readOnly
        />
      </Section>

      <p className="text-small text-secondary-light">Your account already exists — nothing to re-submit here.</p>

      <Button type="button" onClick={onNext}>
        Continue
      </Button>
    </div>
  );
}

function RegisterFields({
  isDemo,
  onNext,
  patch,
}: {
  isDemo: boolean;
  onNext: (credentials: { email: string; password: string }) => void;
  patch: ReturnType<typeof useWizardStore.getState>['patch'];
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const [subdomainEdited, setSubdomainEdited] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema), mode: 'onTouched' });

  const groupName = watch('groupName');
  useEffect(() => {
    if (!subdomainEdited) {
      setValue('subdomain', slugify(groupName ?? ''), { shouldValidate: false });
    }
  }, [groupName, subdomainEdited, setValue]);

  async function onSubmit(values: RegisterFormValues) {
    setFormError(null);
    try {
      const result = await apiFetch<{ tenantId: string; userId: string; subdomain: string; verificationToken: string }>(
        '/auth/register',
        {
          method: 'POST',
          body: {
            subdomain: values.subdomain,
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
          subdomain: result.subdomain,
        },
        accountCreated: true,
        verificationToken: result.verificationToken,
      });
      onNext({ email: values.email, password: values.password });
    } catch (error) {
      if (error instanceof ApiError && error.isCode('SUBDOMAIN_TAKEN')) {
        setError('subdomain', { message: error.message });
        return;
      }
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  const subdomainField = register('subdomain');

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
            <Input label="Phone" type="tel" autoComplete="tel" {...register('phone')} error={errors.phone?.message} />
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
          <Input
            label="Subdomain"
            hint={`Auto-suggested from your hotel name (e.g. "Grand Lagos Hotel" → grand-lagos-hotel). This is your account's login id, not a public web address yet — feel free to change it.`}
            {...subdomainField}
            onChange={(event) => {
              setSubdomainEdited(true);
              subdomainField.onChange(event);
            }}
            error={errors.subdomain?.message}
          />
        </Section>

        {formError ? <p className="text-small text-red-600">{formError}</p> : null}

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
