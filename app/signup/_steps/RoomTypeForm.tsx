'use client';

import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { MultiSelectTagInput } from '@/components/ui/MultiSelectTagInput';
import { Button } from '@/components/ui/Button';
import { roomTypeSchema, type RoomTypeFormValues } from '@/lib/schemas/onboarding';
import { useWizardStore } from '@/lib/store/wizardStore';
import { useAutosaveDraft } from '@/lib/useAutosaveDraft';

const AMENITY_OPTIONS = [
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'ac', label: 'Air conditioning' },
  { value: 'minibar', label: 'Minibar' },
  { value: 'tv', label: 'TV' },
  { value: 'balcony', label: 'Balcony' },
];

/**
 * Onboarding step 4a (Roomick-UI.pdf "Room Types") —
 * property/dto/room-type.dto.ts's CreateRoomTypeDto. Purely local, like
 * every step from Organization Structure onward — see PHASE_NOTES.md's
 * "deferred submission" entry and BranchSetupForm's header comment.
 */
export function RoomTypeForm({ onNext }: { onNext: () => void }) {
  const roomType = useWizardStore((state) => state.roomType);
  const patch = useWizardStore((state) => state.patch);
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RoomTypeFormValues>({
    resolver: zodResolver(roomTypeSchema),
    defaultValues: roomType ?? { adults: 2, children: 0, amenities: [] },
    mode: 'onTouched',
  });

  useAutosaveDraft(watch, (values) => patch({ roomType: values }));

  function onSubmit(values: RoomTypeFormValues) {
    patch({ roomType: values });
    onNext();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Section label="Room type">
        <Input label="Name" hint="e.g. Deluxe King" {...register('name')} error={errors.name?.message} />
        <Input
          label="Base Nightly Rate"
          type="number"
          step="0.01"
          {...register('baseRate', { valueAsNumber: true })}
          error={errors.baseRate?.message}
        />
        <Input label="Bed Type" hint="e.g. king, twin" {...register('bedType')} error={errors.bedType?.message} />
        <Input
          label="Room Size"
          type="number"
          step="0.1"
          hint="Square meters, optional"
          // Not `valueAsNumber` — this field is optional, and an empty
          // string coerced with valueAsNumber becomes NaN, not undefined,
          // which fails z.number().optional()'s check. setValueAs maps the
          // empty case to undefined explicitly instead.
          {...register('sizeM2', { setValueAs: (v) => (v === '' ? undefined : Number(v)) })}
          error={errors.sizeM2?.message}
        />
      </Section>

      <Section label="Capacity">
        <Input label="Adults" type="number" {...register('adults', { valueAsNumber: true })} error={errors.adults?.message} />
        <Input
          label="Children"
          type="number"
          {...register('children', { valueAsNumber: true })}
          error={errors.children?.message}
        />
      </Section>

      <Section label="Amenities">
        <Controller
          control={control}
          name="amenities"
          render={({ field }) => (
            <MultiSelectTagInput
              name="amenities"
              label="Amenities"
              options={AMENITY_OPTIONS}
              value={field.value ?? []}
              onChange={field.onChange}
              allowCustom
              hint="Pick from common amenities or type your own and hit Add"
            />
          )}
        />
      </Section>

      <Button type="submit" loading={isSubmitting}>
        Continue
      </Button>
    </form>
  );
}
