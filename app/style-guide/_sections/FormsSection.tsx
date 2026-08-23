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
import { RadioCard } from '@/components/ui/RadioCard';
import { LogoUpload } from '@/components/ui/LogoUpload';
import { FormSection } from '@/components/ui/FormSection';
import { Section } from '@/components/ui/Section';
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

const ID_TYPE_OPTIONS: SelectOption[] = [
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'nin', label: 'NIN' },
  { value: 'passport', label: 'Passport' },
  { value: 'student_id', label: 'Student ID card' },
];

// Illustrative only — the real Check-In ID-capture flow is a later phase.
// This just proves RadioCard's variant="toggle" swaps content correctly.
function DigitalCaptureDemo() {
  const [idType, setIdType] = useState<string | null>('passport');
  return (
    <div className="flex flex-col gap-4">
      <Select name="idType" label="ID Type" options={ID_TYPE_OPTIONS} value={idType} onChange={setIdType} />
      <LogoUpload label="ID Upload" file={null} onFileChange={() => {}} hint="Upload front and back picture of ID to extract ID number and expiry date." />
    </div>
  );
}

function ManualCaptureDemo() {
  return <Textarea label="ID details" placeholder="Enter ID number, type, and expiry date manually..." />;
}

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
      name="brandMode"
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
    mode: 'onBlur',
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
  const [captureMode, setCaptureMode] = useState<'digital' | 'manual' | null>('digital');

  return (
    <section className="flex flex-col gap-8">
      <h2 className="text-header font-bold text-secondary">Forms</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <Input label="Text Input" placeholder="Type here..." hint="A helper hint shown via the info icon" />
        <Input label="Text Input (error state)" defaultValue="oops" error="This field is required" />
        <Textarea label="Description" placeholder="Type your description here..." />
        <Select
          name="roomType"
          label="Room Type"
          options={ROOM_TYPE_OPTIONS}
          value={roomType}
          onChange={setRoomType}
          placeholder="Select an option"
        />
        <YesNoToggle label="Needs housekeeping today?" name="housekeeping" value={housekeeping} onChange={setHousekeeping} />
        <MultiSelectTagInput
          name="amenities"
          label="Amenities (pick from list)"
          options={AMENITY_OPTIONS}
          value={amenities}
          onChange={setAmenities}
        />
        <MultiSelectTagInput
          name="customTags"
          label="Custom tags (free text)"
          options={[]}
          value={customTags}
          onChange={setCustomTags}
          allowCustom
        />
        <LogoUpload file={logoFile} onFileChange={setLogoFile} />
      </div>

      <div>
        <h3 className="text-subheader font-semibold text-secondary mb-3">
          Brand mode (standalone) — wrapped in <code className="text-tiny">Section</code>, matching real usage
        </h3>
        <div className="max-w-sm">
          <Section label="Organization Structure">
            <BrandRadioCard
              name="standaloneBrandMode"
              value={standaloneMode}
              onChange={setStandaloneMode}
              brandName={standaloneBrandName}
              onBrandNameChange={setStandaloneBrandName}
            />
          </Section>
        </div>
      </div>

      <div>
        <h3 className="text-subheader font-semibold text-secondary mb-3">ID capture — same RadioCard primitive</h3>
        <p className="text-small text-secondary-light max-w-prose mb-3">
          No <code className="text-tiny">description</code> on either option ⇒ a plain radio row, with the selected
          option&apos;s content nested below in its own Card — the same rendering path as Brand Mode above, just
          different data.
        </p>
        <div className="max-w-md">
          <Section label="ID Capture">
            <RadioCard
              tone="secondary"
              name="captureMode"
              options={[
                { value: 'digital', title: 'Digital Capture', content: <DigitalCaptureDemo /> },
                { value: 'manual', title: 'Manual Capture', content: <ManualCaptureDemo /> },
              ]}
              value={captureMode}
              onChange={setCaptureMode}
            />
          </Section>
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
