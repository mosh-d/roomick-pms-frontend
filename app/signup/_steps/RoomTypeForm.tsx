'use client';

import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { MultiSelectTagInput } from '@/components/ui/MultiSelectTagInput';
import { Button } from '@/components/ui/Button';
import { XIcon, PlusIcon } from '@/components/ui/Icons';
import { roomTypeSchema } from '@/lib/schemas/onboarding';
import { useWizardStore, type RoomTypeDraft } from '@/lib/store/wizardStore';
import { useAutosaveDraft } from '@/lib/useAutosaveDraft';
import { currencySymbolFor } from '@/lib/currencies';
import { toTitleCase } from '@/lib/textFormat';

const AMENITY_OPTIONS = [
  { value: 'wifi', label: 'Wi-Fi' },
  { value: 'ac', label: 'Air Conditioning' },
  { value: 'minibar', label: 'Minibar' },
  { value: 'tv', label: 'TV' },
  { value: 'balcony', label: 'Balcony' },
];

const formSchema = z.object({ roomTypes: z.array(roomTypeSchema).min(1) });
type FormValues = z.infer<typeof formSchema>;

/**
 * Onboarding step (Roomick-UI.pdf "Set up room types for {building}") —
 * property/dto/room-type.dto.ts's CreateRoomTypeDto, now a repeatable list
 * ("+ Add room type", `useFieldArray` — same pattern `StaffInviteStep`
 * already uses for its invite rows) matching the reference exactly.
 *
 * **Branch-scoped, not per-building**, despite the reference framing its
 * breadcrumb/heading around a specific building: the actual
 * `RoomType.branchId` column (and the DB reference doc's own stated
 * hierarchy, "Brand → Branch → Building → Floor → Room" — Room Types
 * aren't in that chain) both put room types at the branch level. Building
 * a fake per-building split with nothing backing it in storage would just
 * be confusing the moment a second building's room type list silently
 * showed the first building's entries too. Documented reference/backend
 * mismatch, same pattern as the others already logged in PHASE_NOTES.md.
 *
 * Base Nightly Rate is prefixed with the branch's own currency symbol
 * (`lib/currencies.ts`'s `currencySymbolFor`) — a bare number with no
 * currency shown next to it is ambiguous the moment more than one currency
 * exists anywhere in the product.
 */
export function RoomTypeForm({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const activeBranchLocalId = useWizardStore((state) => state.activeBranchLocalId);
  const branches = useWizardStore((state) => state.branches);
  const patch = useWizardStore((state) => state.patch);
  const branch = branches.find((b) => b.localId === activeBranchLocalId);
  const currencySymbol = currencySymbolFor(branch?.currency);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      roomTypes:
        branch && branch.roomTypes.length > 0
          ? branch.roomTypes
          : [{ name: '', baseRate: 0, adults: 2, children: 0, amenities: [] }],
    },
    mode: 'onTouched',
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'roomTypes' });

  useAutosaveDraft(watch, (values) => {
    if (!branch) return;
    patch({ branches: branches.map((b) => (b.localId === branch.localId ? { ...b, roomTypes: toRoomTypeDrafts(values.roomTypes, b.roomTypes) } : b)) });
  });

  if (!branch) return null;

  function onSubmit(values: FormValues) {
    patch({
      branches: branches.map((b) => (b.localId === branch!.localId ? { ...b, roomTypes: toRoomTypeDrafts(values.roomTypes, b.roomTypes) } : b)),
    });
    onNext();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {fields.map((field, index) => (
        <Section key={field.id} label={`Room Type ${index + 1}`}>
          {fields.length > 1 ? (
            <button
              type="button"
              onClick={() => remove(index)}
              aria-label="Remove room type"
              className="self-end text-secondary-light hover:text-secondary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
            >
              <XIcon className="size-4" />
            </button>
          ) : null}
          <Input
            label="Room Type Name"
            hint="e.g. Deluxe King"
            {...register(`roomTypes.${index}.name`)}
            error={errors.roomTypes?.[index]?.name?.message}
          />
          <Controller
            control={control}
            name={`roomTypes.${index}.baseRate`}
            render={({ field: rateField }) => (
              <CurrencyInput
                label="Base Nightly Rate"
                name={`roomTypes.${index}.baseRate`}
                prefix={currencySymbol || undefined}
                value={rateField.value}
                onChange={(v) => rateField.onChange(v ?? 0)}
                error={errors.roomTypes?.[index]?.baseRate?.message}
              />
            )}
          />
          <Input
            label="Bed Type"
            hint="e.g. king, twin"
            {...register(`roomTypes.${index}.bedType`, {
              // Normalized on blur, not every keystroke — forcing
              // capitalization mid-word while someone's still typing
              // "king s..." would be actively disruptive, not helpful.
              onBlur: (event) => setValue(`roomTypes.${index}.bedType`, toTitleCase(event.target.value)),
            })}
            error={errors.roomTypes?.[index]?.bedType?.message}
          />
          <Input
            label="Room Size (in square meters)"
            type="number"
            step="0.1"
            suffix="m²"
            // Not `valueAsNumber` — optional field; an empty string coerced
            // with valueAsNumber becomes NaN, not undefined, which fails
            // z.number().optional(). setValueAs maps empty to undefined.
            {...register(`roomTypes.${index}.sizeM2`, {
              setValueAs: (v) => (v === '' ? undefined : Number(v)),
              // `step="0.1"` only guides the spinner arrows — a free-typed
              // "32.567" isn't rejected by the browser itself. Rounded on
              // blur (not every keystroke, same reasoning as Bed Type's
              // title-case above) to match `RoomType.sizeM2`'s actual
              // `Decimal(6,1)` column — caught live from a real Finish-time
              // "Request validation failed" this schema gave no warning
              // for beforehand (see roomTypeSchema's own comment).
              onBlur: (event) => {
                if (event.target.value === '') return;
                setValue(`roomTypes.${index}.sizeM2`, Number(Number(event.target.value).toFixed(1)), {
                  shouldValidate: true,
                });
              },
            })}
            error={errors.roomTypes?.[index]?.sizeM2?.message}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Input
              label="Adults"
              type="number"
              {...register(`roomTypes.${index}.adults`, { valueAsNumber: true })}
              error={errors.roomTypes?.[index]?.adults?.message}
            />
            <Input
              label="Children"
              type="number"
              {...register(`roomTypes.${index}.children`, { valueAsNumber: true })}
              error={errors.roomTypes?.[index]?.children?.message}
            />
          </div>
          <Controller
            control={control}
            name={`roomTypes.${index}.amenities`}
            render={({ field: amenitiesField }) => (
              <MultiSelectTagInput
                name={`roomTypes.${index}.amenities`}
                label="Amenities"
                options={AMENITY_OPTIONS}
                value={amenitiesField.value ?? []}
                onChange={amenitiesField.onChange}
                allowCustom
                formatTag={toTitleCase}
                hint="Pick from common amenities or type your own and hit Add"
              />
            )}
          />
        </Section>
      ))}

      <button
        type="button"
        onClick={() => append({ name: '', baseRate: 0, adults: 2, children: 0, amenities: [] })}
        className="inline-flex items-center gap-1 self-start text-body font-semibold text-primary-text hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-control"
      >
        <PlusIcon className="size-4" /> Add room type
      </button>

      <div className="flex items-center gap-3">
        <Button type="button" variant="secondary" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" loading={isSubmitting}>
          Continue
        </Button>
      </div>
    </form>
  );
}

/** Reuses `localId`/`id` positionally from `existing` — a room card already points at a room type by `localId`, which a re-save shouldn't silently reassign. */
function toRoomTypeDrafts(values: FormValues['roomTypes'], existing: RoomTypeDraft[]): RoomTypeDraft[] {
  return values.map((value, index) => ({
    ...value,
    localId: existing[index]?.localId ?? crypto.randomUUID(),
    id: existing[index]?.id ?? null,
  }));
}
