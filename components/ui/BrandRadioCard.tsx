'use client';

import { Input } from './Input';
import { RadioCard, type RadioCardOption } from './RadioCard';

export type BrandMode = 'single' | 'multi';

/**
 * Maps directly to the backend's BrandMode enum ('single' | 'multi',
 * confirmed in roomick-pms-backend/prisma/schema.prisma) — this is the
 * onboarding control for it. A thin domain-specific wrapper around the
 * generic `RadioCard` primitive (see RadioCard.tsx): this file owns the
 * BrandMode-specific option copy and the "Single Brand nests a Brand Name
 * field" business rule, and delegates all the actual radio/card rendering
 * to RadioCard.
 *
 * No `description` on either option — the actual product reference
 * (Roomick-UI.pdf, "Organization Structure" step) renders this choice as a
 * plain radio row with no explanatory text, which is exactly what omitting
 * `description` produces in RadioCard's unified model (an earlier version
 * of this file invented descriptive copy that doesn't match the reference
 * and has been removed).
 *
 * "Single-Brand Structure" needs exactly one brand name up front (P1's
 * register() flow auto-creates that hidden brand — see
 * roomick-pms-backend/PHASE_NOTES.md); "Multi-Brand Structure" manages
 * brand names elsewhere once multiple exist, so no nested field there.
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
  const options: RadioCardOption<BrandMode>[] = [
    {
      value: 'single',
      title: 'Single-Brand Structure',
      content: (
        <Input
          label="Brand Name"
          // Derived from the outer `name` prop, not hardcoded — a
          // hardcoded "brandName" collided (duplicate DOM id) the moment
          // a second BrandRadioCard existed on the same page, which is
          // exactly what happened once the style guide had both a
          // standalone demo and one inside the RHF form.
          name={`${name}-brandName`}
          value={brandName}
          onChange={(event) => onBrandNameChange(event.target.value)}
          error={brandNameError}
          placeholder="e.g. Caritas Inn"
        />
      ),
    },
    {
      value: 'multi',
      title: 'Multi-Brand Structure',
    },
  ];

  return <RadioCard tone="secondary" options={options} value={value} onChange={onChange} name={name} />;
}
