'use client';

import { useState } from 'react';
import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';
import { BrandRadioCard, type BrandMode } from '@/components/ui/BrandRadioCard';
import { apiFetch, ApiError } from '@/lib/api';
import { configureModeSchema } from '@/lib/schemas/onboarding';
import { useAuthStore } from '@/lib/store/authStore';

type ConfigureModeResponse = { tenant: { id: string; brandMode: BrandMode }; brand: { id: string } | null };

/**
 * Onboarding step 2 (Roomick-UI.pdf "Organization Structure") — fixes
 * single/multi-brand mode via POST /tenants/configure-mode. Delegates the
 * actual choice UI to `BrandRadioCard`, built earlier in Phase 1 for
 * exactly this DTO.
 *
 * Mode/brand name are plain local state, not React Hook Form, matching how
 * the demo/real choice on this same page is handled — BrandRadioCard's
 * controlled value/onChange API isn't RHF's `register()` shape, and this
 * is only two fields, so validating the parsed values directly against
 * `configureModeSchema` on submit (rather than wiring an RHF Controller)
 * keeps this consistent with that existing pattern instead of introducing
 * a second one for two fields.
 *
 * Single mode returns an auto-created hidden brand (`brand.id`); multi mode
 * returns `brand: null` — the caller creates the tenant's first visible
 * brand next (see CreateBrandStep) before branch setup can run, since
 * every branch is created under a brandId.
 */
export function OrgStructureForm({ onSuccess }: { onSuccess: (result: { mode: BrandMode; brandId: string | null }) => void }) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const tenantId = useAuthStore((state) => state.user?.tenantId);

  const [mode, setMode] = useState<BrandMode | null>(null);
  const [brandName, setBrandName] = useState('');
  const [brandNameError, setBrandNameError] = useState<string | undefined>();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setFormError(null);
    setBrandNameError(undefined);
    if (!mode) {
      setFormError('Choose a structure to continue.');
      return;
    }
    const parsed = configureModeSchema.safeParse({ mode, brandName });
    if (!parsed.success) {
      setBrandNameError(parsed.error.issues.find((issue) => issue.path[0] === 'brandName')?.message);
      return;
    }

    setSubmitting(true);
    try {
      const result = await apiFetch<ConfigureModeResponse>('/tenants/configure-mode', {
        method: 'POST',
        accessToken: accessToken ?? undefined,
        tenantId,
        body: { mode: parsed.data.mode, brandName: parsed.data.brandName || undefined },
      });
      onSuccess({ mode: result.tenant.brandMode, brandId: result.brand?.id ?? null });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Section label="Organization structure">
        <BrandRadioCard
          name="brandMode"
          value={mode}
          onChange={setMode}
          brandName={brandName}
          onBrandNameChange={setBrandName}
          brandNameError={brandNameError}
        />
      </Section>

      {formError ? <p className="text-small text-red-600">{formError}</p> : null}

      <Button type="button" onClick={handleSubmit} loading={submitting}>
        Continue
      </Button>
    </div>
  );
}
