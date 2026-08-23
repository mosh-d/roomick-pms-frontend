'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { branchSetupSchema, type BranchSetupFormValues } from '@/lib/schemas/onboarding';
import { useWizardStore } from '@/lib/store/wizardStore';
import { useAutosaveDraft } from '@/lib/useAutosaveDraft';
import { COUNTRIES } from '@/lib/countries';
import { defaultTimezoneFor } from '@/lib/timezones';
import { defaultCurrencyFor } from '@/lib/currencies';

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
 * the reference image showing one), no tax-rule/staff-invite sections here
 * (staff invite is its own later step; tax rules have no backend support
 * at all yet — see PHASE_NOTES.md).
 *
 * Purely local now, like every step from Organization Structure through
 * Rooms/Staff Invite (see PHASE_NOTES.md's "deferred submission" entry):
 * validates, saves to `wizardStore`, advances — no `POST /brands/:id/
 * branches` call here. That call only happens once, as part of Review's
 * "Finish" chain, once a real `brandId` actually exists.
 *
 * Country is a real dropdown (`lib/countries.ts`, the same static ISO
 * 3166-1 list `RegisterForm`'s Country field already uses — reused, not a
 * second copy). Timezone and currency have **no field in this form at
 * all** — both are derived silently from the chosen Country
 * (`lib/timezones.ts`, `lib/currencies.ts`) and written straight into RHF
 * state via `setValue`, direct request: asking separately for two things a
 * country selection already implies was judged unnecessary friction.
 * Currency is a safe silent default for nearly every country (one official
 * currency each); timezone is a genuine, accepted compromise for
 * multi-zone countries (a US hotel outside `America/New_York` gets the
 * "wrong" one with no way to correct it from this screen — the DB column
 * is required and night-audit-critical, so it still needs *some* valid
 * value, just not a user-facing field for it here). Check-in/check-out use
 * a native `<input type="time">` via Input's HTML passthrough rather than
 * a custom time-picker component.
 */
export function BranchSetupForm({ onNext }: { onNext: () => void }) {
  const branch = useWizardStore((state) => state.branch);
  const patch = useWizardStore((state) => state.patch);
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<BranchSetupFormValues>({
    resolver: zodResolver(branchSetupSchema),
    defaultValues: branch ?? { checkInTime: '14:00', checkOutTime: '11:00' },
    mode: 'onTouched',
  });

  // Mirrors every keystroke into wizardStore (debounced), not just
  // submitted values — a reload mid-edit resumes from here instead of
  // losing whatever hadn't been submitted yet. See useAutosaveDraft.ts.
  useAutosaveDraft(watch, (values) => patch({ branch: values }));

  // Both derived silently from Country, no field of their own — see this
  // file's header comment. Runs on every Country change, unconditionally
  // (no "has the owner edited this" tracking needed, since there's nothing
  // for them to edit).
  const country = watch('country');
  useEffect(() => {
    setValue('timezone', defaultTimezoneFor(country) ?? '', { shouldValidate: false });
    setValue('currency', defaultCurrencyFor(country) ?? '', { shouldValidate: false });
  }, [country, setValue]);

  function onSubmit(values: BranchSetupFormValues) {
    patch({ branch: values });
    onNext();
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
        <Input label="Postal Code" {...register('zip')} error={errors.zip?.message} />
      </Section>

      <Section label="Operations">
        <Input label="Check-in Time" type="time" {...register('checkInTime')} error={errors.checkInTime?.message} />
        <Input label="Check-out Time" type="time" {...register('checkOutTime')} error={errors.checkOutTime?.message} />
      </Section>

      <Button type="submit" loading={isSubmitting}>
        Continue
      </Button>
    </form>
  );
}
