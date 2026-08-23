'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { branchSetupSchema, type BranchSetupFormValues } from '@/lib/schemas/onboarding';
import { useWizardStore } from '@/lib/store/wizardStore';
import { useAutosaveDraft } from '@/lib/useAutosaveDraft';

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
 * Country/timezone/currency are free-text fields with format hints, not
 * proper pickers (a full IANA-timezone or ISO-4217-currency dropdown is
 * real data-entry work deferred to later — see PHASE_NOTES.md); check-in/
 * check-out use a native `<input type="time">` via Input's HTML passthrough
 * rather than a custom time-picker component.
 */
export function BranchSetupForm({ onNext }: { onNext: () => void }) {
  const branch = useWizardStore((state) => state.branch);
  const patch = useWizardStore((state) => state.patch);
  const {
    register,
    handleSubmit,
    control,
    watch,
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

      <Button type="submit" loading={isSubmitting}>
        Continue
      </Button>
    </form>
  );
}
