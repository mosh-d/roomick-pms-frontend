'use client';

import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { RadioCard } from '@/components/ui/RadioCard';
import { MultiSelectTagInput } from '@/components/ui/MultiSelectTagInput';
import { ALL_CHARGES, TAXABLE_CHARGE_TYPES, type TaxRuleDraftValues } from '@/lib/taxes';

const INCLUSION_OPTIONS: SelectOption[] = [
  { value: 'exclusive', label: 'Exclusive' },
  { value: 'inclusive', label: 'Inclusive' },
];

const APPLIES_TO_OPTIONS: SelectOption[] = [...TAXABLE_CHARGE_TYPES, { value: ALL_CHARGES, label: 'All' }];

/**
 * One tax rule's fields, as the reference's Tax Rule Builder lays them out
 * (Roomick-UI.pdf, Organization Structure and Branch Setup): Tax Name, Type
 * (Exclusive / Inclusive), Tax Rate (Fixed Rate / Percentage Rate, with the
 * figure underneath) and Applies to. Controlled and stateless, so onboarding
 * (a list of draft rules) and Property Config (one rule in a dialog) share it.
 *
 * `idPrefix` keeps field ids — and the radio group's name — apart when
 * several rules are on screen at once.
 */
export function TaxRuleFields({
  idPrefix,
  value,
  onChange,
  currency,
}: {
  idPrefix: string;
  value: TaxRuleDraftValues;
  onChange: (next: TaxRuleDraftValues) => void;
  /** The branch's ISO currency code, shown beside a fixed amount; omit where there isn't one yet (brand-wide defaults). */
  currency?: string;
}) {
  const set = <K extends keyof TaxRuleDraftValues>(key: K, next: TaxRuleDraftValues[K]) => onChange({ ...value, [key]: next });

  // "All" and particular charge types are either/or: ticking All clears the
  // rest, and ticking anything else takes All off.
  function setAppliesTo(next: string[]) {
    const addedAll = next.includes(ALL_CHARGES) && !value.appliesTo.includes(ALL_CHARGES);
    set('appliesTo', addedAll ? [ALL_CHARGES] : next.filter((v) => v !== ALL_CHARGES));
  }

  const amountField =
    value.type === 'fixed' ? (
      <Input
        id={`${idPrefix}-amount`}
        label="Fixed Amount"
        type="number"
        inputMode="decimal"
        min={0}
        step="0.01"
        suffix={currency || undefined}
        hint={currency ? 'Charged once per charge — once per night on room charges.' : "In each branch's own currency, once per charge — once per night on room charges."}
        value={value.value}
        onChange={(e) => set('value', e.target.value)}
      />
    ) : (
      <Input
        id={`${idPrefix}-percentage`}
        label="Rate Percentage"
        type="number"
        inputMode="decimal"
        min={0}
        max={100}
        step="0.01"
        suffix="%"
        hint="7.5 for 7.5%."
        value={value.value}
        onChange={(e) => set('value', e.target.value)}
      />
    );

  return (
    <div className="flex flex-col gap-3">
      <Input
        id={`${idPrefix}-name`}
        label="Tax Name"
        hint="As it should read on the bill — VAT, Service Charge, Consumption Tax."
        value={value.name}
        onChange={(e) => set('name', e.target.value)}
        maxLength={100}
      />
      <Select
        id={`${idPrefix}-type`}
        label="Type"
        options={INCLUSION_OPTIONS}
        value={value.inclusive ? 'inclusive' : 'exclusive'}
        onChange={(v) => set('inclusive', v === 'inclusive')}
        hint="Exclusive: added on top of the price. Inclusive: already inside your prices — the guest pays the price, and the bill shows how much of it was tax."
      />
      <fieldset className="flex flex-col gap-2">
        <legend className="text-small font-semibold text-secondary mb-2">Tax Rate</legend>
        <RadioCard
          name={`${idPrefix}-kind`}
          options={[
            { value: 'fixed', title: 'Fixed Rate', content: value.type === 'fixed' ? amountField : undefined },
            { value: 'percentage', title: 'Percentage Rate', content: value.type === 'percentage' ? amountField : undefined },
          ]}
          value={value.type}
          onChange={(kind) => onChange({ ...value, type: kind, value: '' })}
        />
      </fieldset>
      <MultiSelectTagInput
        id={`${idPrefix}-applies-to`}
        label="Applies to"
        options={APPLIES_TO_OPTIONS}
        value={value.appliesTo}
        onChange={setAppliesTo}
        hint="Which charges this tax goes on. All covers every charge on a bill."
      />
    </div>
  );
}
