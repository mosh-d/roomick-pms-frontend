'use client';

import { useState } from 'react';
import { useForm, useFieldArray, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { XIcon, PlusIcon } from '@/components/ui/Icons';
import { roomCardSchema, setupPatternSchema, type SetupPatternFormValues } from '@/lib/schemas/onboarding';
import { useWizardStore, type RoomCardDraft } from '@/lib/store/wizardStore';
import { useAutosaveDraft } from '@/lib/useAutosaveDraft';

const formSchema = z.object({ rooms: z.array(roomCardSchema).min(1) });
type FormValues = z.infer<typeof formSchema>;

/**
 * Onboarding step (Roomick-UI.pdf "Set up individual rooms (for {floor})")
 * — genuinely floor-scoped, matching `Room.floorId` exactly (the backend's
 * "Rooms Only" hidden-default-floor shortcut every earlier phase of this
 * wizard used is gone now that real buildings/floors exist — see
 * PHASE_NOTES.md). Two ways onto the same list, matching the reference:
 * "+ Add room" appends one blank card by hand; "+ Generate" opens the
 * Setup Pattern modal and computes many at once. Neither calls the backend
 * — still deferred submission; both just grow `branch.rooms` (a flat list
 * across every floor in the branch, filtered to the active floor here).
 *
 * Room Type options come from `branch.roomTypes` (configured the step
 * before this one) — a room card can't reference a type that doesn't
 * exist yet, so this step is unreachable with an empty room-type list (see
 * page.tsx's step gating).
 */
export function RoomsForm({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const activeBranchLocalId = useWizardStore((state) => state.activeBranchLocalId);
  const activeFloorLocalId = useWizardStore((state) => state.activeFloorLocalId);
  const branches = useWizardStore((state) => state.branches);
  const patch = useWizardStore((state) => state.patch);
  const [patternOpen, setPatternOpen] = useState(false);

  const branch = branches.find((b) => b.localId === activeBranchLocalId);
  const floorLabel = floorLabelFor(branch, activeFloorLocalId);
  const roomTypeOptions = (branch?.roomTypes ?? []).map((rt) => ({ value: rt.localId, label: rt.name || 'Untitled room type' }));
  const existingCards = branch?.rooms.filter((r) => r.floorLocalId === activeFloorLocalId) ?? [];

  const {
    register,
    handleSubmit,
    control,
    watch,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      rooms:
        existingCards.length > 0
          ? existingCards.map((c) => ({ roomTypeLocalId: c.roomTypeLocalId, number: c.number, view: c.view ?? '' }))
          : [{ roomTypeLocalId: roomTypeOptions[0]?.value ?? '', number: '', view: '' }],
    },
    mode: 'onTouched',
  });
  const { fields, append, remove, replace } = useFieldArray({ control, name: 'rooms' });

  // Mirrors debounced edits into *this floor's slice* of `branch.rooms`,
  // leaving every other floor's cards untouched — same pattern as every
  // other step's autosave, just filtered to one floor.
  useAutosaveDraft(watch, (values) => saveToStore(values));

  if (!branch || !activeFloorLocalId) return null;

  function saveToStore(values: FormValues) {
    const otherFloors = branch!.rooms.filter((r) => r.floorLocalId !== activeFloorLocalId);
    const thisFloor = toRoomCardDrafts(values.rooms, existingCards, activeFloorLocalId!);
    patch({ branches: branches.map((b) => (b.localId === branch!.localId ? { ...b, rooms: [...otherFloors, ...thisFloor] } : b)) });
  }

  function onSubmit(values: FormValues) {
    saveToStore(values);
    onNext();
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Section label={`Rooms — ${floorLabel}`}>
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-end gap-3">
              <div className="flex-1">
                <Controller
                  control={control}
                  name={`rooms.${index}.roomTypeLocalId`}
                  render={({ field: rtField }) => (
                    <Select
                      name={`rooms.${index}.roomTypeLocalId`}
                      label="Room Type"
                      options={roomTypeOptions}
                      value={rtField.value || null}
                      onChange={rtField.onChange}
                      error={errors.rooms?.[index]?.roomTypeLocalId?.message}
                    />
                  )}
                />
              </div>
              <div className="flex-1">
                <Input
                  label="Room Number"
                  {...register(`rooms.${index}.number`)}
                  error={errors.rooms?.[index]?.number?.message}
                />
              </div>
              <div className="flex-1">
                <Input label="View" hint="Optional, e.g. sea, garden" {...register(`rooms.${index}.view`)} />
              </div>
              {fields.length > 1 ? (
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label="Remove room"
                  className="mb-2 text-secondary-light hover:text-secondary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
                >
                  <XIcon className="size-4" />
                </button>
              ) : null}
            </div>
          ))}

          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => append({ roomTypeLocalId: roomTypeOptions[0]?.value ?? '', number: '', view: '' })}
              className="inline-flex items-center gap-1 text-body font-semibold text-primary-text hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-control"
            >
              <PlusIcon className="size-4" /> Add room
            </button>
            <button
              type="button"
              onClick={() => setPatternOpen(true)}
              className="inline-flex items-center gap-1 text-body font-semibold text-primary-text hover:underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-control"
            >
              <PlusIcon className="size-4" /> Generate
            </button>
          </div>
        </Section>

        <div className="flex items-center gap-3">
          <Button type="button" variant="secondary" onClick={onBack}>
            Back
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Continue
          </Button>
        </div>
      </form>

      <SetupPatternModal
        open={patternOpen}
        onClose={() => setPatternOpen(false)}
        roomTypeOptions={roomTypeOptions}
        onGenerate={(cards) => {
          // `getValues()`, not `fields` — useFieldArray's `fields` only
          // tracks the array's *structure* (add/remove/reorder); each
          // row's own inputs are uncontrolled (`register()`), so their
          // live typed values never show up in `fields` itself. Reading
          // `fields[i].number` here previously silently dropped whatever
          // had actually been typed into an existing row the moment
          // Generate ran (caught live, not assumed).
          const current = getValues('rooms');
          // Drop the one placeholder row a fresh floor starts with if it's
          // still untouched (no room number typed) — otherwise Generate
          // would leave a dangling unfilled card alongside the real ones.
          const isUntouchedPlaceholder = current.length === 1 && !current[0].number;
          replace([...(isUntouchedPlaceholder ? [] : current), ...cards]);
          setPatternOpen(false);
        }}
      />
    </>
  );
}

function floorLabelFor(branch: { buildings: { localId: string; name: string; floors: { localId: string; floorNumber: number }[] }[] } | undefined, floorLocalId: string | null) {
  if (!branch || !floorLocalId) return '';
  for (const building of branch.buildings) {
    const floor = building.floors.find((f) => f.localId === floorLocalId);
    if (floor) return `${building.name || 'Building'} · Floor ${floor.floorNumber}`;
  }
  return '';
}

function toRoomCardDrafts(values: FormValues['rooms'], existing: RoomCardDraft[], floorLocalId: string): RoomCardDraft[] {
  return values.map((value, index) => ({
    ...value,
    localId: existing[index]?.localId ?? crypto.randomUUID(),
    id: existing[index]?.id ?? null,
    floorLocalId,
  }));
}

/** The "Setup Pattern" modal (Generate) — computes N room-number strings client-side (`startingNumber`, incrementing by `increment`) rather than calling the backend; the caller just appends the result into the floor's card list. */
function SetupPatternModal({
  open,
  onClose,
  roomTypeOptions,
  onGenerate,
}: {
  open: boolean;
  onClose: () => void;
  roomTypeOptions: { value: string; label: string }[];
  onGenerate: (cards: { roomTypeLocalId: string; number: string; view: string }[]) => void;
}) {
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<SetupPatternFormValues>({
    resolver: zodResolver(setupPatternSchema),
    defaultValues: { roomTypeLocalId: roomTypeOptions[0]?.value ?? '', startingNumber: 101, count: 1, increment: 1, view: '' },
  });

  function onSubmit(values: SetupPatternFormValues) {
    const cards = Array.from({ length: values.count }, (_, i) => ({
      roomTypeLocalId: values.roomTypeLocalId,
      number: String(values.startingNumber + i * values.increment),
      view: values.view ?? '',
    }));
    onGenerate(cards);
    reset();
  }

  return (
    <Modal open={open} onClose={onClose} title="Setup Pattern">
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Controller
          control={control}
          name="roomTypeLocalId"
          render={({ field }) => (
            <Select
              name="patternRoomType"
              label="Room Type"
              options={roomTypeOptions}
              value={field.value || null}
              onChange={field.onChange}
              error={errors.roomTypeLocalId?.message}
            />
          )}
        />
        <Input
          label="Starting Room Number"
          type="number"
          {...register('startingNumber', { valueAsNumber: true })}
          error={errors.startingNumber?.message}
        />
        <Input label="Number of Rooms" type="number" {...register('count', { valueAsNumber: true })} error={errors.count?.message} />
        <Input label="View" hint="Optional, applies to every generated room" {...register('view')} />
        <Input
          label="Increment Pattern"
          type="number"
          hint="e.g. 1 for 201, 202, 203…; 2 for 201, 203, 205…"
          {...register('increment', { valueAsNumber: true })}
          error={errors.increment?.message}
        />
        <p className="text-small text-secondary-light">This will replace any existing rooms in this generated range.</p>
        <Button type="submit">Generate</Button>
      </form>
    </Modal>
  );
}
