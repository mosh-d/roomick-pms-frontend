'use client';

import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { RadioCard } from '@/components/ui/RadioCard';
import { MultiSelectTagInput } from '@/components/ui/MultiSelectTagInput';
import { XIcon, PlusIcon } from '@/components/ui/Icons';
import { buildingSchema } from '@/lib/schemas/onboarding';
import { useWizardStore, type BuildingDraft, type FloorDraft } from '@/lib/store/wizardStore';
import { useAutosaveDraft } from '@/lib/useAutosaveDraft';

const formSchema = z.object({ buildings: z.array(buildingSchema).min(1) });
type FormValues = z.infer<typeof formSchema>;

/**
 * Onboarding step (Roomick-UI.pdf "Set up individual buildings and floors
 * for {branch}") — the first piece of "Full" onboarding mode (see
 * PHASE_NOTES.md): every prior phase used the backend's "Rooms Only"
 * shortcut (a hidden default building/floor auto-created), this is the
 * real thing.
 *
 * Floors are a plain count per building (`CreateFloorDto.floorNumber` is
 * just an int; `label` is optional and unused here), not individually
 * authored — matches the reference mockup exactly, which only ever shows a
 * "Number of floors" stepper, never a per-floor name field. `+ Add
 * building` is always available rather than gating it behind a separate
 * "Single/Multi-Building Property" toggle the reference also shows — one
 * building already behaves like "Single-Building" with no extra state to
 * keep in sync with the list's own length.
 */
export function BuildingsFloorsForm({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const activeBranchLocalId = useWizardStore((state) => state.activeBranchLocalId);
  const branches = useWizardStore((state) => state.branches);
  const patch = useWizardStore((state) => state.patch);
  const branch = branches.find((b) => b.localId === activeBranchLocalId);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      buildings:
        branch && branch.buildings.length > 0
          ? branch.buildings.map((b) => ({
              name: b.name,
              isMultiFloor: b.floors.length > 1,
              floorCount: b.floors.length,
              views: b.views,
            }))
          : [{ name: '', isMultiFloor: false, floorCount: 1, views: [] }],
    },
    mode: 'onTouched',
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'buildings' });

  useAutosaveDraft(watch, (values) => {
    if (!branch) return;
    patch({ branches: branches.map((b) => (b.localId === branch.localId ? { ...b, buildings: toBuildingDrafts(values.buildings, b.buildings) } : b)) });
  });

  if (!branch) return null;

  function onSubmit(values: FormValues) {
    patch({
      branches: branches.map((b) => (b.localId === branch!.localId ? { ...b, buildings: toBuildingDrafts(values.buildings, b.buildings) } : b)),
    });
    onNext();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      {fields.map((field, index) => {
        const isMultiFloor = watch(`buildings.${index}.isMultiFloor`);
        return (
          <Section key={field.id} label={`Building ${index + 1}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <Controller
                  control={control}
                  name={`buildings.${index}.name`}
                  render={({ field: nameField }) => (
                    <Input label="Building Name" {...nameField} error={errors.buildings?.[index]?.name?.message} />
                  )}
                />
              </div>
              {fields.length > 1 ? (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label="Remove building"
                  className="mt-6 text-secondary-light hover:text-secondary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
                >
                  <XIcon className="size-4" />
                </button>
              ) : null}
            </div>

            <Controller
              control={control}
              name={`buildings.${index}.isMultiFloor`}
              render={({ field: modeField }) => (
                <RadioCard
                  name={`buildings.${index}.floorMode`}
                  value={modeField.value ? 'multi' : 'single'}
                  onChange={(mode) => modeField.onChange(mode === 'multi')}
                  options={[
                    { value: 'single', title: 'Single Floor' },
                    { value: 'multi', title: 'Multiple Floors' },
                  ]}
                />
              )}
            />

            {isMultiFloor ? (
              <Controller
                control={control}
                name={`buildings.${index}.floorCount`}
                render={({ field: countField }) => (
                  <Input
                    label="Number of floors"
                    type="number"
                    min={1}
                    value={countField.value}
                    onChange={(event) => countField.onChange(Number(event.target.value))}
                    error={errors.buildings?.[index]?.floorCount?.message}
                  />
                )}
              />
            ) : null}

            <Controller
              control={control}
              name={`buildings.${index}.views`}
              render={({ field: viewsField }) => (
                <MultiSelectTagInput
                  name={`buildings.${index}.views`}
                  label="Views"
                  options={[]}
                  value={viewsField.value ?? []}
                  onChange={viewsField.onChange}
                  allowCustom
                  hint="Type a view (e.g. sea, garden) and hit Add"
                />
              )}
            />
          </Section>
        );
      })}

      <button
        type="button"
        onClick={() => append({ name: '', isMultiFloor: false, floorCount: 1, views: [] })}
        className="inline-flex items-center gap-1 self-start text-body font-semibold text-primary-text hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-control"
      >
        <PlusIcon className="size-4" /> Add building
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

/**
 * Expands `floorCount` into real `FloorDraft`s (floorNumber 0..N-1) —
 * reuses `localId`s from `existing` positionally where they already exist,
 * so a floor a room card already points at doesn't get a fresh id (and
 * silently orphan that reference) just because the owner re-saved this
 * form without actually changing the count.
 */
function toBuildingDrafts(values: FormValues['buildings'], existing: BuildingDraft[]): BuildingDraft[] {
  return values.map((value, index) => {
    const prior = existing[index];
    const floors: FloorDraft[] = Array.from({ length: value.isMultiFloor ? value.floorCount : 1 }, (_, floorNumber) => {
      const priorFloor = prior?.floors[floorNumber];
      return priorFloor ?? { localId: crypto.randomUUID(), id: null, floorNumber };
    });
    return {
      localId: prior?.localId ?? crypto.randomUUID(),
      id: prior?.id ?? null,
      name: value.name,
      views: value.views ?? [],
      floors,
    };
  });
}
