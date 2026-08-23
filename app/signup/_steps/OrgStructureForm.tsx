'use client';

import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { RadioCard, type RadioCardOption } from '@/components/ui/RadioCard';
import { useWizardStore, type BrandMode } from '@/lib/store/wizardStore';

const BRAND_MODE_OPTIONS: RadioCardOption<BrandMode>[] = [
  { value: 'single', title: 'Single-Brand Structure' },
  { value: 'multi', title: 'Multi-Brand Structure' },
];

/**
 * Onboarding step 2 (Roomick-UI.pdf "Organization Structure") — picks
 * single vs. multi-brand mode. Purely local now (see PHASE_NOTES.md's
 * "deferred submission" entry): no API call here at all — `configure-mode`
 * only fires once, as part of Review's "Finish" chain, along with
 * everything else this wizard collects from here on. That's also what
 * fixed "nothing shows up when I click Multi-Brand Structure": there was
 * never meant to be different content for the two options once the
 * redundant "Brand Name" field was removed from this step entirely (the
 * head brand's name always comes from the organization name already
 * collected at signup) — both are now plain radio choices.
 *
 * Renders `RadioCard` (the generic primitive, see RadioCard.tsx) directly
 * rather than through a `BrandRadioCard` wrapper — this was the only
 * production call site for that wrapper, and it added nothing beyond this
 * one option array, so it's inlined here instead of kept as a whole extra
 * file. `BuildingsFloorsForm.tsx` and `page.tsx` already use `RadioCard`
 * this same direct way for their own choices.
 */
export function OrgStructureForm({ onNext }: { onNext: () => void }) {
  const brandMode = useWizardStore((state) => state.brandMode);
  const patch = useWizardStore((state) => state.patch);

  function handleContinue() {
    if (!brandMode) return;
    onNext();
  }

  return (
    <div className="flex flex-col gap-4">
      <Section label="Organization structure">
        <RadioCard
          tone="secondary"
          name="brandMode"
          options={BRAND_MODE_OPTIONS}
          value={brandMode}
          onChange={(mode) => patch({ brandMode: mode })}
        />
      </Section>

      {!brandMode ? <p className="text-small text-secondary-light">Choose a structure to continue.</p> : null}

      <Button type="button" onClick={handleContinue} disabled={!brandMode}>
        Continue
      </Button>
    </div>
  );
}
