'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { apiFetch, ApiError } from '@/lib/api';
import { registerSchema, type RegisterFormValues } from '@/lib/schemas/auth';

export type RegisterResponse = { tenantId: string; userId: string; subdomain: string; verificationToken: string };

/**
 * Step 1 of the onboarding wizard (Roomick-UI.pdf "Owner Account Form") —
 * two-column field layout (First/Last Name, Email/Phone) matching the
 * reference exactly. Built against the real backend DTO
 * (auth/dto/register.dto.ts), not the reference doc's payload example —
 * they disagree (see PHASE_NOTES.md).
 *
 * The reference's Step 1 has no Group/Hotel Name or Subdomain field —
 * those only appear here (in an "Organization" section below Owner
 * Account) because `POST /auth/register` genuinely requires both in the
 * same call to create the tenant; there's no later point in the flow where
 * they could be collected instead without restructuring the backend's
 * registration sequence. A `Country` field is also on the reference's Step
 * 1 and isn't built here — `RegisterDto` has no matching field for it at
 * all (a fourth reference/backend field mismatch), and the global
 * `ValidationPipe`'s `forbidNonWhitelisted: true` means sending it would
 * make the request fail outright, not just get silently ignored.
 *
 * `onSuccess` also hands back the raw email/password the owner just typed —
 * not stored anywhere past this step, just threaded forward in memory so
 * `AutoLoginStep` can log the owner in immediately after email verification
 * (register/verify-email issue no access token; see that step's comment).
 */
export function RegisterForm({
  isDemo,
  onSuccess,
}: {
  isDemo: boolean;
  onSuccess: (result: RegisterResponse, credentials: { email: string; password: string }) => void;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormValues>({ resolver: zodResolver(registerSchema), mode: 'onBlur' });

  async function onSubmit(values: RegisterFormValues) {
    setFormError(null);
    try {
      const result = await apiFetch<RegisterResponse>('/auth/register', {
        method: 'POST',
        body: {
          subdomain: values.subdomain,
          groupName: values.groupName,
          name: `${values.firstName} ${values.lastName}`.trim(),
          email: values.email,
          password: values.password,
          phone: values.phone || undefined,
          isDemo,
        },
      });
      onSuccess(result, { email: values.email, password: values.password });
    } catch (error) {
      if (error instanceof ApiError && error.isCode('SUBDOMAIN_TAKEN')) {
        setError('subdomain', { message: error.message });
        return;
      }
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
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
            <Input label="First Name" {...register('firstName')} error={errors.firstName?.message} />
            <Input label="Last Name" {...register('lastName')} error={errors.lastName?.message} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Input label="Email" type="email" {...register('email')} error={errors.email?.message} />
            <Input label="Phone" {...register('phone')} error={errors.phone?.message} />
          </div>
          <Input
            label="Password"
            type="password"
            hint="At least 8 characters, with an uppercase letter, a lowercase letter, and a number"
            {...register('password')}
            error={errors.password?.message}
          />
        </Section>

        <Section label="Organization">
          <Input label="Group / Hotel Name" {...register('groupName')} error={errors.groupName?.message} />
          <Input
            label="Subdomain"
            hint="A short, unique id for your account — you'll use it to log in (e.g. acme)"
            {...register('subdomain')}
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
