'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { RadioCard } from '@/components/ui/RadioCard';
import { TaxRuleBuilder, taxRuleListProblems } from '@/components/tax/TaxRuleBuilder';
import { describeTaxRuleDraft } from '@/lib/taxes';
import { currencySymbolFor } from '@/lib/currencies';
import { branchSetupSchema, type BranchSetupFormValues } from '@/lib/schemas/onboarding';
import { branchTaxSetup, useWizardStore, type BranchDraft } from '@/lib/store/wizardStore';
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

/**
 * Only this form's own fields. The draft also carries room types, buildings
 * and tax rules; handing the whole draft to react-hook-form as defaults made
 * every autosave write those back as they were when the step opened — which,
 * with tax rules edited on this same step, would quietly undo them.
 */
const FORM_FIELDS = Object.keys(branchSetupSchema.shape) as Array<keyof BranchSetupFormValues>;
function formFieldsOf(values: Partial<BranchSetupFormValues>): Partial<BranchSetupFormValues> {
  return Object.fromEntries(FORM_FIELDS.filter((key) => key in values).map((key) => [key, values[key]])) as Partial<BranchSetupFormValues>;
}

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
    useBrandTaxRules: true,
    taxRules: [],
    createdTaxRuleLocalIds: [],
  };
}

/**
 * Onboarding step (Roomick-UI.pdf "Branch Setup") — the physical property.
 * Built directly against property/dto/branch.dto.ts's CreateBranchDto +
 * AddressDto — no star rating (not a DTO field despite the reference image
 * showing one), and no staff-invite section here (staff invite is its own
 * later step).
 *
 * Tax Rule Configuration (the reference's own section): the branch uses the
 * brand's default rules from Organization Structure, or its own, built with
 * the same Tax Rule Builder. Kept outside the react-hook-form state and
 * written straight to `wizardStore`; Continue waits until every rule here is
 * complete.
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
  const brandTaxRules = useWizardStore((state) => state.brandTaxRules);
  const patch = useWizardStore((state) => state.patch);
  const branch = branches.find((b) => b.localId === activeBranchLocalId);
  const [taxAttempted, setTaxAttempted] = useState(false);

  // Read the store at write time, not the render's `branches`: the address
  // autosave (debounced) and the tax rules both write this branch, and a
  // stale copy from either would undo the other's last change.
  function updateBranch(localId: string, change: Partial<BranchDraft>) {
    patch({ branches: useWizardStore.getState().branches.map((b) => (b.localId === localId ? { ...b, ...change } : b)) });
  }

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
    defaultValues: branch ? formFieldsOf(branch) : { checkInTime: '14:00', checkOutTime: '11:00' },
    mode: 'onTouched',
  });

  // Mirrors every keystroke into wizardStore (debounced), not just
  // submitted values — a reload mid-edit resumes from here instead of
  // losing whatever hadn't been submitted yet. See useAutosaveDraft.ts.
  useAutosaveDraft(watch, (values) => {
    if (!branch) return;
    updateBranch(branch.localId, formFieldsOf(values));
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
    // `shouldValidate: true`, not false — a plain value-only `setValue`
    // doesn't touch error state, so a stale "Required" from an earlier
    // empty-field validation pass (e.g. Continue clicked before a country
    // was chosen) would otherwise sit there forever even once this
    // auto-fills a real value. Revalidating here clears it immediately.
    setValue('timezone', defaultTimezoneFor(country) ?? '', { shouldValidate: true });
    setValue('currency', defaultCurrencyFor(country) ?? '', { shouldValidate: true });
  }, [country, setValue]);
  const timezoneOptions = timezoneOptionsFor(country);

  if (!branch) return null;

  const tax = branchTaxSetup(branch, brandTaxRules);
  const taxRulesReady = tax.useBrand || taxRuleListProblems(tax.ownRules).every((problem) => problem === null);
  const symbol = currencySymbolFor(watch('currency') || branch.currency);

  function onSubmit(values: BranchSetupFormValues) {
    if (!taxRulesReady) return;
    updateBranch(branch!.localId, formFieldsOf(values));
    onNext();
  }

  return (
    <form
      onSubmit={(event) => {
        setTaxAttempted(true);
        return handleSubmit(onSubmit)(event);
      }}
      className="flex flex-col gap-4"
    >
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

      <Section label="Tax Rule Configuration">
        <RadioCard
          name={`branch-tax-${branch.localId}`}
          options={[
            {
              value: 'brand',
              title: 'Use Brand Default Tax Rules',
              content: (
                <div className="flex flex-col gap-1">
                  {brandTaxRules.length === 0 ? (
                    <p className="text-small text-surface-muted">The brand has no default tax rules, so this branch will charge no tax until you add some.</p>
                  ) : (
                    brandTaxRules.map((rule) => (
                      <p key={rule.localId} className="text-small text-surface">
                        <span className="font-semibold">{rule.name || 'Untitled'}</span> — {describeTaxRuleDraft(rule, symbol)}
                      </p>
                    ))
                  )}
                </div>
              ),
            },
            {
              value: 'own',
              title: 'Configure Branch Tax Rules',
              content: (
                <TaxRuleBuilder
                  idPrefix={`branch-tax-${branch.localId}`}
                  rules={tax.ownRules}
                  onChange={(rules) => updateBranch(branch.localId, { taxRules: rules })}
                  currency={watch('currency') || branch.currency || undefined}
                  showErrors={taxAttempted}
                />
              ),
            },
          ]}
          value={tax.useBrand ? 'brand' : 'own'}
          onChange={(choice) => updateBranch(branch.localId, { useBrandTaxRules: choice === 'brand' })}
        />
        {taxAttempted && !taxRulesReady ? <p className="text-small text-red-600">Finish or remove the tax rules marked above to continue.</p> : null}
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
