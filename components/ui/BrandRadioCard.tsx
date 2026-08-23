'use client';

import { RadioCard, type RadioCardOption } from './RadioCard';

export type BrandMode = 'single' | 'multi';

/**
 * Maps directly to the backend's BrandMode enum ('single' | 'multi',
 * confirmed in roomick-pms-backend/prisma/schema.prisma) — this is the
 * onboarding control for it. A thin domain-specific wrapper around the
 * generic `RadioCard` primitive (see RadioCard.tsx): this file owns the
 * BrandMode-specific option copy, delegating all the actual radio/card
 * rendering to RadioCard.
 *
 * No `description` on either option — the actual product reference
 * (Roomick-UI.pdf, "Organization Structure" step) renders this choice as a
 * plain radio row with no explanatory text, which is exactly what omitting
 * `description` produces in RadioCard's unified model.
 *
 * No nested "Brand Name" field on either option either (an earlier version
 * had one on `single` only) — the head brand's name always comes from the
 * organization name already collected at signup (`RegisterForm`'s
 * "Group / Hotel Name" field, i.e. the tenant's `groupName`), for single
 * and multi mode alike. Asking for it again here would just be asking
 * twice for the same thing; see `tenants.service.ts`'s `configureMode()`
 * (backend) and `PHASE_NOTES.md` for the reasoning.
 */
export function BrandRadioCard({
  value,
  onChange,
  name = 'brandMode',
}: {
  value: BrandMode | null;
  onChange: (value: BrandMode) => void;
  name?: string;
}) {
  const options: RadioCardOption<BrandMode>[] = [
    { value: 'single', title: 'Single-Brand Structure' },
    { value: 'multi', title: 'Multi-Brand Structure' },
  ];

  return <RadioCard tone="secondary" options={options} value={value} onChange={onChange} name={name} />;
}
