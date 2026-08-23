'use client';

import { useMemo, useState } from 'react';
import { useForm, useFieldArray, useWatch, Controller } from 'react-hook-form';
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
  // Views are configured once per building (Buildings/Floors step, not
  // re-typed per room) — every room card on this floor picks from that
  // same building's list, not free text.
  const activeBuilding = branch ? buildingForFloor(branch, activeFloorLocalId) : undefined;
  const configuredViews = activeBuilding?.views ?? [];
  // A leading "No view" option keeps View genuinely optional — without it,
  // once a room's view is set there'd be no way to pick it back to blank
  // from this dropdown.
  const viewOptions =
    configuredViews.length > 0 ? [{ value: '', label: 'No view' }, ...configuredViews.map((v) => ({ value: v, label: v }))] : [];

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

  function saveToStore(values: FormValues) {
    const otherFloors = branch!.rooms.filter((r) => r.floorLocalId !== activeFloorLocalId);
    const thisFloor = toRoomCardDrafts(values.rooms, existingCards, activeFloorLocalId!);
    patch({ branches: branches.map((b) => (b.localId === branch!.localId ? { ...b, rooms: [...otherFloors, ...thisFloor] } : b)) });
  }

  // Mirrors debounced edits into *this floor's slice* of `branch.rooms`,
  // leaving every other floor's cards untouched — same pattern as every
  // other step's autosave, just filtered to one floor.
  useAutosaveDraft(watch, saveToStore);

  // Live snapshot of this floor's in-progress numbers (including
  // not-yet-saved edits) — re-renders on every keystroke via useWatch, but
  // cheaply: a room-card list is never more than a few dozen rows, and this
  // one subscription now drives *both* the duplicate check below and the
  // Setup Pattern modal's live "will replace" preview.
  const liveRooms = useWatch({ control, name: 'rooms' });
  const numbersOnOtherFloors = (branch?.rooms ?? []).filter((r) => r.floorLocalId !== activeFloorLocalId).map((r) => r.number);
  const existingNumbersOnFloor = (liveRooms ?? []).map((r) => r?.number).filter((n): n is string => Boolean(n));

  /**
   * Plain derived state, not `setError`/`clearErrors` — an earlier version
   * imperatively set/cleared duplicate errors from a `watch` effect, but
   * that raced RHF's own resolver-driven `onTouched` revalidation (which
   * replaces the *whole* errors object on every blur/change and knows
   * nothing about a custom, non-schema "duplicate" error): a `clearErrors`
   * call could win the race for one row and lose it for another, leaving a
   * stale warning stuck on an already-corrected number even after its
   * duplicate was fixed elsewhere. Deriving straight from `liveRooms` every
   * render sidesteps that race entirely — there's no separate error state
   * to fall out of sync with the values that produced it.
   */
  const duplicateIndexes = useMemo(
    () => findDuplicateNumberIndexes((liveRooms ?? []) as { number?: string }[], new Set(numbersOnOtherFloors)),
    [liveRooms, numbersOnOtherFloors],
  );

  if (!branch || !activeFloorLocalId) return null;

  /**
   * `Room.number` is unique per *branch* in the real schema
   * (`@@unique([branchId, number])`), not just per floor — real hotels
   * don't reuse a room number across floors of the same property either.
   * `duplicateIndexes` above already renders the warning live as it's
   * typed; this is just the final gate blocking "Continue" while any
   * duplicate remains.
   */
  function onSubmit(values: FormValues) {
    if (duplicateIndexes.size > 0) return;
    saveToStore(values);
    onNext();
  }

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Section label={`Rooms — ${floorLabel}`}>
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-start gap-6">
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
                  error={
                    errors.rooms?.[index]?.number?.message ??
                    (duplicateIndexes.has(index) ? 'Room number already used elsewhere in this branch' : undefined)
                  }
                />
              </div>
              <div className="flex-1">
                <Controller
                  control={control}
                  name={`rooms.${index}.view`}
                  render={({ field: viewField }) => (
                    <Select
                      name={`rooms.${index}.view`}
                      label="View"
                      options={viewOptions}
                      // `?? null`, not `|| null` — `''` ("No view") is a
                      // real, distinct option here, not an absent value;
                      // `||` would coerce it to `null` and the dropdown
                      // would never show "No view" as actually selected.
                      value={viewField.value ?? null}
                      onChange={viewField.onChange}
                      disabled={viewOptions.length === 0}
                      hint={
                        viewOptions.length === 0
                          ? 'No views configured for this building yet — add some in the Buildings step.'
                          : 'Optional'
                      }
                    />
                  )}
                />
              </div>
              {fields.length > 1 ? (
                // `items-start` (not `items-end`) is what keeps every
                // label on one line regardless of which field has a hint
                // pushing its own box taller (View's does, the others
                // don't) — this button gets its own `mt-6` instead of the
                // row-level `mb-2` that used to center it against the
                // shared baseline, so it still lands next to the input
                // itself, not up at label height.
                <button
                  type="button"
                  onClick={() => remove(index)}
                  aria-label="Remove room"
                  className="mt-6 text-secondary-light hover:text-secondary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
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
        viewOptions={configuredViews.map((v) => ({ value: v, label: v }))}
        existingNumbersOnFloor={existingNumbersOnFloor}
        numbersOnOtherFloors={numbersOnOtherFloors}
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
          // Actually implements the modal's own printed promise ("This
          // will replace any existing rooms in this generated range") —
          // previously this just appended the new batch, so generating
          // over a range that already had rooms (a re-generate, or an
          // overlapping manual entry) silently created duplicate room
          // numbers on this floor instead of replacing them.
          const newNumbers = new Set(cards.map((c) => c.number));
          const kept = (isUntouchedPlaceholder ? [] : current).filter((c) => !newNumbers.has(c.number));
          replace([...kept, ...cards]);
          setPatternOpen(false);
        }}
      />
    </>
  );
}

/**
 * Two passes, not one: counting first means *every* row sharing a number
 * gets flagged, not just the second one seen — flagging only the second
 * occurrence would leave the first row looking fine while the second has
 * an unexplained error for the exact same number. Shared by the live
 * per-keystroke check and the submit-time gate so they can't drift apart.
 */
function findDuplicateNumberIndexes(rooms: { number?: string }[], otherFloorNumbers: Set<string>): Set<number> {
  const counts = new Map<string, number>();
  for (const room of rooms) {
    if (room?.number) counts.set(room.number, (counts.get(room.number) ?? 0) + 1);
  }
  const duplicated = new Set<number>();
  rooms.forEach((room, index) => {
    if (!room?.number) return;
    if ((counts.get(room.number) ?? 0) > 1 || otherFloorNumbers.has(room.number)) duplicated.add(index);
  });
  return duplicated;
}

type BranchLike = { buildings: { localId: string; name: string; views?: string[]; floors: { localId: string; floorNumber: number }[] }[] };

function buildingForFloor(branch: BranchLike, floorLocalId: string | null) {
  if (!floorLocalId) return undefined;
  return branch.buildings.find((building) => building.floors.some((f) => f.localId === floorLocalId));
}

function floorLabelFor(branch: BranchLike | undefined, floorLocalId: string | null) {
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

/**
 * Caps how many preview numbers get computed while the pattern is still
 * being typed — `count` can transiently be a huge or nonsensical value
 * mid-edit (the field's own zod max is 500, but that's only enforced on
 * submit), so this keeps the live preview cheap regardless of what's
 * currently in the box.
 */
const PATTERN_PREVIEW_CAP = 500;

function buildPatternPreviewNumbers(startingNumber: number, count: number, increment: number): string[] {
  if (!Number.isFinite(startingNumber) || !Number.isFinite(count) || !Number.isFinite(increment)) return [];
  if (count < 1 || increment < 1) return [];
  const capped = Math.min(count, PATTERN_PREVIEW_CAP);
  return Array.from({ length: capped }, (_, i) => String(startingNumber + i * increment));
}

/** First `max` items of `list`, joined, with a "+N more" suffix once it's longer than that — keeps the warning readable when a generated range collides with dozens of existing rooms. */
function formatNumberList(list: string[], max = 12): string {
  if (list.length <= max) return list.join(', ');
  return `${list.slice(0, max).join(', ')}, +${list.length - max} more`;
}

/** The "Setup Pattern" modal (Generate) — computes N room-number strings client-side (`startingNumber`, incrementing by `increment`) rather than calling the backend; the caller just appends the result into the floor's card list. */
function SetupPatternModal({
  open,
  onClose,
  roomTypeOptions,
  viewOptions,
  existingNumbersOnFloor,
  numbersOnOtherFloors,
  onGenerate,
}: {
  open: boolean;
  onClose: () => void;
  roomTypeOptions: { value: string; label: string }[];
  viewOptions: { value: string; label: string }[];
  /** This floor's current room numbers (including unsaved in-progress edits) — Generate silently *replaces* any of these that fall in the generated range, so they're shown as a live warning while the pattern is typed, not discovered only after clicking Generate. */
  existingNumbersOnFloor: string[];
  /** Numbers already used on other floors of this branch — Generate does *not* replace these (a different floor's room isn't Generate's to touch), so a collision here would become a real, unresolved duplicate instead. */
  numbersOnOtherFloors: string[];
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

  const startingNumber = useWatch({ control, name: 'startingNumber' });
  const count = useWatch({ control, name: 'count' });
  const increment = useWatch({ control, name: 'increment' });
  const previewNumbers = buildPatternPreviewNumbers(startingNumber, count, increment);
  const willReplace = previewNumbers.filter((n) => existingNumbersOnFloor.includes(n));
  const otherFloorConflicts = previewNumbers.filter((n) => numbersOnOtherFloors.includes(n));

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
        <Controller
          control={control}
          name="view"
          render={({ field }) => (
            <Select
              name="patternView"
              label="View"
              options={viewOptions}
              value={field.value || null}
              onChange={field.onChange}
              disabled={viewOptions.length === 0}
              hint={viewOptions.length === 0 ? 'No views configured for this building yet' : 'Optional, applies to every generated room'}
            />
          )}
        />
        <Input
          label="Increment Pattern"
          type="number"
          hint="e.g. 1 for 201, 202, 203…; 2 for 201, 203, 205…"
          {...register('increment', { valueAsNumber: true })}
          error={errors.increment?.message}
        />
        {willReplace.length > 0 ? (
          <p className="text-small text-red-600">
            {willReplace.length} existing room{willReplace.length > 1 ? 's' : ''} on this floor will be replaced:{' '}
            {formatNumberList(willReplace)}
          </p>
        ) : (
          <p className="text-small text-secondary-light">This will replace any existing rooms in this generated range.</p>
        )}
        {otherFloorConflicts.length > 0 ? (
          <p className="text-small text-red-600">
            {otherFloorConflicts.length} of these number{otherFloorConflicts.length > 1 ? 's are' : ' is'} already used on another floor
            in this branch: {formatNumberList(otherFloorConflicts)}. You&apos;ll need to change {otherFloorConflicts.length > 1 ? 'them' : 'it'} after
            generating.
          </p>
        ) : null}
        <Button type="submit">Generate</Button>
      </form>
    </Modal>
  );
}
