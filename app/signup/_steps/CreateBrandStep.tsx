'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { apiFetch, ApiError } from '@/lib/api';
import { createBrandSchema, type CreateBrandFormValues } from '@/lib/schemas/onboarding';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * Multi-brand-mode-only step: configure-mode doesn't auto-create a brand
 * when mode is 'multi' (unlike single mode — see OrgStructureForm), so the
 * owner needs to create their first brand here before branch setup can run
 * (every branch is created under a brandId). Later brands are brand-
 * management work, out of scope for this wizard.
 */
export function CreateBrandStep({ onSuccess }: { onSuccess: (brandId: string) => void }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const tenantId = useAuthStore((state) => state.user?.tenantId);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateBrandFormValues>({ resolver: zodResolver(createBrandSchema) });

  async function onSubmit(values: CreateBrandFormValues) {
    setFormError(null);
    try {
      const brand = await apiFetch<{ id: string }>('/brands', {
        method: 'POST',
        accessToken: accessToken ?? undefined,
        tenantId,
        body: values,
      });
      onSuccess(brand.id);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Section label="Your first brand">
        <Input label="Brand Name" hint="e.g. Acme Resorts" {...register('name')} error={errors.name?.message} />
      </Section>

      {formError ? <p className="text-small text-red-600">{formError}</p> : null}

      <Button type="submit" loading={isSubmitting}>
        Continue
      </Button>
    </form>
  );
}
