'use client';

import { Input } from './Input';

export type BrandMode = 'single' | 'multi';

const OPTIONS: { value: BrandMode; title: string; description: string }[] = [
  { value: 'single', title: 'Single Brand', description: 'One brand across every property in this account.' },
  { value: 'multi', title: 'Multi Brand', description: 'Manage several distinct brands under one account.' },
];

/**
 * Maps directly to the backend's BrandMode enum ('single' | 'multi',
 * confirmed in roomick-pms-backend/prisma/schema.prisma) — this is the
 * onboarding control for it. Same native-radio + sr-only pattern as
 * YesNoToggle (full keyboard/AT support for free), but block-level cards
 * instead of pill segments.
 *
 * Selected state reuses the exact same tint classes Card.tsx uses for its
 * `tone="primary"` — `bg-primary-dark/10 border-primary-dark/20` (the dark
 * variant, not raw primary gold — see Card.tsx's TONE_CLASSES comment for
 * why) — deliberately: a selected radio-card IS a Card visually, just one
 * that also happens to be
 * a clickable label wrapping a radio input, so it's built by hand here
 * rather than composed from <Card> (which renders a plain, non-interactive
 * div).
 *
 * "Single Brand" mode needs exactly one brand name up front (P1's
 * register() flow auto-creates that hidden brand — see
 * roomick-pms-backend/PHASE_NOTES.md); "Multi Brand" mode manages brand
 * names elsewhere once multiple exist, so no nested field here.
 */
export function BrandRadioCard({
  value,
  onChange,
  brandName,
  onBrandNameChange,
  brandNameError,
  name = 'brandMode',
}: {
  value: BrandMode | null;
  onChange: (value: BrandMode) => void;
  brandName: string;
  onBrandNameChange: (value: string) => void;
  brandNameError?: string;
  name?: string;
}) {
  return (
    <div className="flex flex-col gap-3">
      {OPTIONS.map((option) => {
        const isSelected = value === option.value;
        const inputId = `${name}-${option.value}`;
        return (
          <div key={option.value} className="flex flex-col gap-1.5">
            <input
              type="radio"
              id={inputId}
              name={name}
              value={option.value}
              checked={isSelected}
              onChange={() => onChange(option.value)}
              className="sr-only peer"
            />
            <label
              htmlFor={inputId}
              className={`flex flex-col gap-1 rounded-card border p-4 cursor-pointer transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-primary peer-focus-visible:ring-offset-2 ${
                isSelected ? 'bg-primary-dark/10 border-primary-dark/20' : 'border-accent/40'
              }`}
            >
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={`size-4 rounded-full border-2 flex items-center justify-center ${
                    isSelected ? 'border-primary' : 'border-accent'
                  }`}
                >
                  {isSelected ? <span className="size-2 rounded-full bg-primary" /> : null}
                </span>
                <span className="text-body font-semibold text-secondary">{option.title}</span>
              </span>
              <span className="text-small text-secondary-light pl-6">{option.description}</span>
            </label>

            {isSelected && option.value === 'single' ? (
              <div className="pl-6">
                <Input
                  label="Brand Name"
                  name="brandName"
                  value={brandName}
                  onChange={(event) => onBrandNameChange(event.target.value)}
                  error={brandNameError}
                  placeholder="e.g. Caritas Inn"
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
