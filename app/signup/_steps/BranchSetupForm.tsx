'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { apiFetch, ApiError } from '@/lib/api';
import { branchSetupSchema, type BranchSetupFormValues } from '@/lib/schemas/onboarding';
import { useAuthStore } from '@/lib/store/authStore';

export type BranchResponse = {
  id: string;
  name: string;
  address: unknown;
  currency: string;
  timezone: string;
  category: string | null;
};

const CATEGORY_OPTIONS = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'resort', label: 'Resort' },
  { value: 'motel', label: 'Motel' },
  { value: 'boutique', label: 'Boutique' },
  { value: 'hostel', label: 'Hostel' },
];

/**
 * Onboarding step 3 (Roomick-UI.pdf "Branch Setup") — the physical
 * property. Built directly against property/dto/branch.dto.ts's
 * CreateBranchDto + AddressDto — no star rating (not a DTO field despite
 * the reference image showing one), no tax-rule/staff-invite sections
 * (branch-management work, not first-run onboarding; see PHASE_NOTES.md).
 *
 * Country/timezone/currency are free-text fields with format hints, not
 * proper pickers (a full IANA-timezone or ISO-4217-currency dropdown is
 * real data-entry work deferred to later — see PHASE_NOTES.md); check-in/
 * check-out use a native `<input type="time">` via Input's HTML passthrough
 * rather than a custom time-picker component.
 */
export function BranchSetupForm({ brandId, onSuccess }: { brandId: string; onSuccess: (branch: BranchResponse) => void }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const tenantId = useAuthStore((state) => state.user?.tenantId);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BranchSetupFormValues>({
    resolver: zodResolver(branchSetupSchema),
    defaultValues: { checkInTime: '14:00', checkOutTime: '11:00' },
  });

  async function onSubmit(values: BranchSetupFormValues) {
    setFormError(null);
    try {
      const branch = await apiFetch<BranchResponse>(`/brands/${brandId}/branches`, {
        method: 'POST',
        accessToken: accessToken ?? undefined,
        tenantId,
        body: {
          name: values.name,
          address: {
            street: values.street,
            city: values.city,
            state: values.state || undefined,
            country: values.country,
            zip: values.zip || undefined,
          },
          timezone: values.timezone,
          currency: values.currency,
          checkInTime: values.checkInTime || undefined,
          checkOutTime: values.checkOutTime || undefined,
          category: values.category || undefined,
        },
      });
      onSuccess(branch);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Section label="Property">
        <Input label="Property Name" {...register('name')} error={errors.name?.message} />
        <Controller
          control={control}
          name="category"
          render={({ field }) => (
            <Select
              name="category"
              label="Category"
              options={CATEGORY_OPTIONS}
              value={field.value || null}
              onChange={field.onChange}
              error={errors.category?.message}
            />
          )}
        />
      </Section>

      <Section label="Address">
        <Input label="Street" {...register('street')} error={errors.street?.message} />
        <Input label="City" {...register('city')} error={errors.city?.message} />
        <Input label="State / Region" {...register('state')} error={errors.state?.message} />
        <Input
          label="Country"
          hint="ISO 3166-1 alpha-2 code, e.g. NG, US, GB"
          {...register('country')}
          error={errors.country?.message}
        />
        <Input label="Postal Code" {...register('zip')} error={errors.zip?.message} />
      </Section>

      <Section label="Operations">
        <Input
          label="Timezone"
          hint="IANA timezone, e.g. Africa/Lagos"
          {...register('timezone')}
          error={errors.timezone?.message}
        />
        <Input
          label="Currency"
          hint="ISO 4217 code, e.g. NGN, USD"
          {...register('currency')}
          error={errors.currency?.message}
        />
        <Input label="Check-in Time" type="time" {...register('checkInTime')} error={errors.checkInTime?.message} />
        <Input label="Check-out Time" type="time" {...register('checkOutTime')} error={errors.checkOutTime?.message} />
      </Section>

      {formError ? <p className="text-small text-red-600">{formError}</p> : null}

      <Button type="submit" loading={isSubmitting}>
        Continue
      </Button>
    </form>
  );
}
