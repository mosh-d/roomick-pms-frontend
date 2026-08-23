'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { branchSetupSchema, type BranchSetupFormValues } from '@/lib/schemas/onboarding';
import { useWizardStore, type BranchDraft } from '@/lib/store/wizardStore';
import { useAutosaveDraft } from '@/lib/useAutosaveDraft';
import { COUNTRIES } from '@/lib/countries';
import { defaultTimezoneFor, timezoneOptionsFor } from '@/lib/timezones';
import { defaultCurrencyFor } from '@/lib/currencies';

const CATEGORY_OPTIONS = [
  { value: 'hotel', label: 'Hotel' },
  { value: 'resort', label: 'Resort' },
  { value: 'motel', label: 'Motel' },
  { value: 'boutique', label: 'Boutique' },
  { value: 'hostel', label: 'Hostel' },
];

export function emptyBranchDraft(): BranchDraft {
  return {
    localId: crypto.randomUUID(),
    id: null,
    name: '',
    street: '',
    city: '',
    state: '',
    country: '',
    zip: '',
    timezone: '',
    currency: '',
    checkInTime: '14:00',
    checkOutTime: '11:00',
    category: undefined,
    roomTypes: [],
    buildings: [],
    rooms: [],
  };
}

/**
 * Onboarding step (Roomick-UI.pdf "Branch Setup") — the physical property.
 * Built directly against property/dto/branch.dto.ts's CreateBranchDto +
 * AddressDto — no star rating (not a DTO field despite the reference image
 * showing one), no tax-rule/staff-invite sections here (staff invite is
 * its own later step; tax rules have no backend support at all yet — see
 * PHASE_NOTES.md).
 *
 * One of potentially several branches now (`wizardStore.branches`, "Full"
 * onboarding mode — see PHASE_NOTES.md): this component always edits
 * whichever branch `activeBranchLocalId` points at, creating a fresh one
 * on mount if there's no active branch yet (the very first time this step
 * is reached). Adding a *second* branch is triggered from `WizardShell`'s
 * sidebar tree, not from a button on this form — the tree is where every
 * other "+" affordance in the Full-mode wizard already lives.
 *
 * Purely local, like every step from Organization Structure onward (see
 * PHASE_NOTES.md's "deferred submission" entry): validates, saves to
 * `wizardStore`, advances — no `POST /brands/:id/branches` call here.
 * That call only happens once per branch, as part of Review's "Finish"
 * chain, once a real `brandId` actually exists.
 *
 * Country is a real dropdown (`lib/countries.ts`, the same static ISO
 * 3166-1 list `RegisterForm`'s Country field already uses — reused, not a
 * second copy). Currency has **no field of its own** — one official
 * currency per country covers nearly every real case, so it's derived
 * silently (`lib/currencies.ts`) and written straight into RHF state via
 * `setValue`, direct request: asking separately for something a country
 * selection already implies was judged unnecessary friction.
 *
 * Timezone *is* its own dropdown (`lib/timezones.ts`'s `timezoneOptionsFor`)
 * — unlike Currency, "one default per country" isn't good enough here: the
 * DB column is required and night-audit-critical (confirmed against the
 * schema, not assumed — `Branch.timezone`'s own comment), and several
 * countries this app supports genuinely span more than one real zone (the
 * US, Russia, Canada, Australia, ...). The dropdown's *options* change with
 * the selected Country (every real zone for the ~15 multi-zone countries,
 * one option for everyone else), pre-selected to that country's
 * most-populous zone but freely correctable from the same list — the
 * actual fix for "which of my country's zones is this property in", not
 * just a better guess. Check-in/check-out use a native `<input
 * type="time">` via Input's HTML passthrough rather than a custom
 * time-picker component.
 */
export function BranchSetupForm({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const activeBranchLocalId = useWizardStore((state) => state.activeBranchLocalId);
  const branches = useWizardStore((state) => state.branches);
  const patch = useWizardStore((state) => state.patch);
  const branch = branches.find((b) => b.localId === activeBranchLocalId);

  useEffect(() => {
    if (branch) return;
    const draft = emptyBranchDraft();
    patch({ branches: [...branches, draft], activeBranchLocalId: draft.localId });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- bootstrap-once guard, see comment above
  }, [branch]);

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
  useAutosaveDraft(watch, (values) => {
    if (!branch) return;
    patch({ branches: branches.map((b) => (b.localId === branch.localId ? { ...b, ...values } : b)) });
  });

  // Currency: derived silently, no field of its own — see this file's
  // header comment. Timezone: only *pre-selects* here — the field itself
  // is a real, freely-correctable dropdown below. Both effects only fire
  // when Country itself changes (not on every render), so a manual
  // Timezone pick from that same country's own option list is never
  // clobbered — only picking a *different* country resets it, which is
  // correct: the old zone generally isn't even a valid option anymore.
  const country = watch('country');
  useEffect(() => {
    setValue('timezone', defaultTimezoneFor(country) ?? '', { shouldValidate: false });
    setValue('currency', defaultCurrencyFor(country) ?? '', { shouldValidate: false });
  }, [country, setValue]);
  const timezoneOptions = timezoneOptionsFor(country);

  if (!branch) return null;

  function onSubmit(values: BranchSetupFormValues) {
    patch({ branches: branches.map((b) => (b.localId === branch!.localId ? { ...b, ...values } : b)) });
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
        <Controller
          control={control}
          name="timezone"
          render={({ field }) => (
            <Select
              name="timezone"
              label="Timezone"
              hint="Pre-filled from Country above — correct it if this property is in a different zone."
              options={timezoneOptions}
              value={field.value || null}
              onChange={field.onChange}
              disabled={timezoneOptions.length === 0}
              error={errors.timezone?.message}
            />
          )}
        />
        <Input label="Check-in Time" type="time" {...register('checkInTime')} error={errors.checkInTime?.message} />
        <Input label="Check-out Time" type="time" {...register('checkOutTime')} error={errors.checkOutTime?.message} />
      </Section>

      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" loading={isSubmitting}>
          Continue
        </Button>
      </div>
    </form>
  );
}
