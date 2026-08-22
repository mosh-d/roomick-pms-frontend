'use client';

import { useState } from 'react';
import { useForm, useController, type Control } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select, type SelectOption } from '@/components/ui/Select';
import { YesNoToggle } from '@/components/ui/YesNoToggle';
import { MultiSelectTagInput } from '@/components/ui/MultiSelectTagInput';
import { BrandRadioCard, type BrandMode } from '@/components/ui/BrandRadioCard';
import { LogoUpload } from '@/components/ui/LogoUpload';
import { FormSection } from '@/components/ui/FormSection';
import { Button } from '@/components/ui/Button';

const ROOM_TYPE_OPTIONS: SelectOption[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'deluxe', label: 'Deluxe' },
  { value: 'suite', label: 'Suite' },
  { value: 'executive', label: 'Executive' },
  { value: 'presidential', label: 'Presidential' },
];

const AMENITY_OPTIONS: SelectOption[] = [
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'parking', label: 'Parking' },
  { value: 'pool', label: 'Pool' },
  { value: 'gym', label: 'Gym' },
];

/**
 * Demonstrates the RHF + Zod pattern documented in
 * design-system/04-components/forms.md: one schema, defined once, powering
 * real-time client validation. `brandMode`/`brandName` are wired through
 * RHF's `Controller` (BrandRadioCard is a controlled component, not a
 * plain-ref-forwarding native input, so `register()` alone can't drive it)
 * while `hotelName` uses plain `register()` since Input forwards its ref
 * directly to a native <input>.
 */
const onboardingSchema = z
  .object({
    hotelName: z.string().min(1, 'Hotel name is required'),
    brandMode: z.enum(['single', 'multi']),
    brandName: z.string().optional(),
  })
  .refine((data) => data.brandMode !== 'single' || Boolean(data.brandName?.trim()), {
    message: 'Brand name is required for Single Brand mode',
    path: ['brandName'],
  });

type OnboardingFormValues = z.infer<typeof onboardingSchema>;

/**
 * BrandRadioCard is a controlled component (value/onChange props), not a
 * ref-forwarding native input, so plain `register()` can't drive it —
 * `useController` is RHF's hook for exactly this: it wires a field into
 * RHF's validation/state machinery while giving back plain value/onChange
 * props to hand to any controlled component, native or custom.
 */
function BrandFields({
  control,
  errors,
}: {
  control: Control<OnboardingFormValues>;
  errors: { brandName?: { message?: string } };
}) {
  const brandMode = useController({ name: 'brandMode', control });
  const brandName = useController({ name: 'brandName', control });

  return (
    <BrandRadioCard
      value={brandMode.field.value as BrandMode}
      onChange={brandMode.field.onChange}
      brandName={brandName.field.value ?? ''}
      onBrandNameChange={brandName.field.onChange}
      brandNameError={errors.brandName?.message}
    />
  );
}

function OnboardingDemoForm() {
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState<OnboardingFormValues | null>(null);
  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: { hotelName: '', brandMode: 'single', brandName: '' },
  });

  async function onSubmit(values: OnboardingFormValues) {
    // No real backend wired up yet (see design-system/04-components/
    // forms.md) — this just proves the schema/resolver/error-path wiring
    // actually works end to end.
    await new Promise((resolve) => setTimeout(resolve, 300));
    setSubmitted(values);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4 max-w-md">
      <FormSection label="Hotel Brand Onboarding">
        <Input label="Hotel Name" {...register('hotelName')} error={errors.hotelName?.message} />
        <BrandFields control={control} errors={errors} />
        <LogoUpload file={logoFile} onFileChange={setLogoFile} />
      </FormSection>

      <Button type="submit" loading={isSubmitting}>
        Save
      </Button>

      {submitted ? (
        <pre className="text-tiny bg-secondary/10 rounded-control p-3 overflow-auto">
          {JSON.stringify({ ...submitted, logo: logoFile?.name ?? null }, null, 2)}
        </pre>
      ) : null}
    </form>
  );
}

export function FormsSection() {
  const [roomType, setRoomType] = useState<string | null>(null);
  const [housekeeping, setHousekeeping] = useState<'yes' | 'no' | null>(null);
  const [amenities, setAmenities] = useState<string[]>(['wifi']);
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [standaloneMode, setStandaloneMode] = useState<BrandMode | null>('single');
  const [standaloneBrandName, setStandaloneBrandName] = useState('Caritas Inn');
  const [logoFile, setLogoFile] = useState<File | null>(null);

  return (
    <section className="flex flex-col gap-8">
      <h2 className="text-header font-bold text-secondary">Forms</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Input label="Text Input" placeholder="Type here..." hint="A helper hint shown via the info icon" />
        <Input label="Text Input (error state)" defaultValue="oops" error="This field is required" />
        <Textarea label="Description" placeholder="Type your description here..." />
        <Select
          label="Room Type"
          options={ROOM_TYPE_OPTIONS}
          value={roomType}
          onChange={setRoomType}
          placeholder="Select an option"
        />
        <YesNoToggle label="Needs housekeeping today?" name="housekeeping" value={housekeeping} onChange={setHousekeeping} />
        <MultiSelectTagInput
          label="Amenities (pick from list)"
          options={AMENITY_OPTIONS}
          value={amenities}
          onChange={setAmenities}
        />
        <MultiSelectTagInput
          label="Custom tags (free text)"
          options={[]}
          value={customTags}
          onChange={setCustomTags}
          allowCustom
        />
        <LogoUpload file={logoFile} onFileChange={setLogoFile} />
      </div>

      <div>
        <h3 className="text-subheader font-semibold text-secondary mb-3">Brand mode (standalone)</h3>
        <div className="max-w-sm">
          <BrandRadioCard
            value={standaloneMode}
            onChange={setStandaloneMode}
            brandName={standaloneBrandName}
            onBrandNameChange={setStandaloneBrandName}
          />
        </div>
      </div>

      <div>
        <h3 className="text-subheader font-semibold text-secondary mb-3">
          Real RHF + Zod demo — schema defined once in this file
        </h3>
        <OnboardingDemoForm />
      </div>
    </section>
  );
}
