'use client';

import { useRef, useState } from 'react';
import { Section } from '@/components/ui/Section';
import { EntryCard } from '@/components/ui/EntryCard';
import { FeatureCard } from '@/components/ui/FeatureCard';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { UploadCloudIcon, CheckIcon, XIcon, PlusIcon } from '@/components/ui/Icons';

const TAX_TYPE_OPTIONS: SelectOption[] = [
  { value: 'inclusive', label: 'Inclusive' },
  { value: 'exclusive', label: 'Exclusive' },
];

type TaxRule = { id: number; name: string; type: string | null };

/**
 * A real, working demo — not a static mock. The reference's "Tax Rule
 * Builder" has both an "+ Add Tax Rule" link and a working × per rule, so
 * this demo actually maintains a `rules` array in state rather than
 * hardcoding two fixed EntryCards with a no-op remove handler (an earlier
 * version of this file did exactly that, which is why neither Add nor
 * Remove worked — caught by the user clicking through the style guide).
 */
function TaxRuleBuilderDemo() {
  const [rules, setRules] = useState<TaxRule[]>([
    { id: 1, name: 'VAT', type: 'inclusive' },
    { id: 2, name: 'Service Charge', type: 'inclusive' },
  ]);
  const nextId = useRef(3);

  function addRule() {
    setRules((prev) => [...prev, { id: nextId.current++, name: '', type: null }]);
  }

  function removeRule(id: number) {
    setRules((prev) => prev.filter((rule) => rule.id !== id));
  }

  function updateRule(id: number, patch: Partial<TaxRule>) {
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)));
  }

  return (
    <Section label="Tax Rule Builder">
      {rules.map((rule, index) => (
        <EntryCard
          key={rule.id}
          title={`Rule ${index + 1}`}
          // Keep at least one rule — matches EntryCard's own documented
          // "omit onRemove for the last remaining required entry" contract.
          onRemove={rules.length > 1 ? () => removeRule(rule.id) : undefined}
        >
          <Input
            label="Tax Name"
            name={`taxName-${rule.id}`}
            value={rule.name}
            onChange={(event) => updateRule(rule.id, { name: event.target.value })}
          />
          <Select
            name={`taxType-${rule.id}`}
            label="Type"
            options={TAX_TYPE_OPTIONS}
            value={rule.type}
            onChange={(value) => updateRule(rule.id, { type: value })}
          />
        </EntryCard>
      ))}
      <button
        type="button"
        onClick={addRule}
        className="self-end inline-flex items-center gap-1 text-body font-semibold text-primary-text hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-control"
      >
        <PlusIcon className="size-4" /> Add Tax Rule
      </button>
    </Section>
  );
}

export function LayoutPatternsSection() {
  return (
    <section className="flex flex-col gap-8">
      <div>
        <h2 className="text-header font-bold text-secondary">Layout patterns</h2>
        <p className="text-small text-secondary-light max-w-prose mt-1">
          Grounded directly in Roomick-UI.pdf — Section (page structure), EntryCard (removable repeatable entries),
          FeatureCard (navigation tiles). See design-system/04-components/layout-patterns.md.
        </p>
      </div>

      <div className="max-w-2xl">
        <h3 className="text-subheader font-semibold text-secondary mb-3">
          Section + EntryCard — reproducing the reference&apos;s Tax Rule Builder
        </h3>
        <TaxRuleBuilderDemo />
      </div>

      <div>
        <h3 className="text-subheader font-semibold text-secondary mb-3">
          FeatureCard — reproducing the reference&apos;s Front Desk hub
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-4xl">
          <FeatureCard
            icon={<UploadCloudIcon />}
            title="Arrivals Dashboard"
            description="Today's expected arrivals, status, room readiness"
            stats={['12 pending arrivals today', '2 VIP guests arriving today']}
            onClick={() => {}}
          />
          <FeatureCard
            icon={<CheckIcon />}
            title="Check-In Flow"
            description="ID capture, room assignment, folio activation"
            stats={['Review guest details', 'Check a guest in']}
            onClick={() => {}}
          />
          <FeatureCard
            icon={<XIcon />}
            title="Walk-In Booking"
            description="Create reservation and check-in in one flow"
            stats={['3 Standard rooms available', '4 Classic rooms available']}
            onClick={() => {}}
          />
        </div>
      </div>
    </section>
  );
}
