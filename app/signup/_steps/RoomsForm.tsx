'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { roomsBulkSchema, type RoomsBulkFormValues } from '@/lib/schemas/onboarding';
import { useWizardStore } from '@/lib/store/wizardStore';
import { useAutosaveDraft } from '@/lib/useAutosaveDraft';

/**
 * Onboarding step 4b (Roomick-UI.pdf "Rooms") — property/dto/rooms.dto.ts's
 * BulkCreateRoomsDto, range variant only (e.g. 301-320); the explicit-
 * numbers variant and per-room floor assignment are deferred (see
 * PHASE_NOTES.md and roomTypeSchema's comment on the same trade-off).
 * `floorId` is omitted entirely — the backend auto-creates a hidden default
 * building/floor for this, its own documented "Rooms Only" onboarding mode.
 *
 * Purely local, like every step from Organization Structure onward — see
 * PHASE_NOTES.md's "deferred submission" entry and BranchSetupForm's
 * header comment.
 */
export function RoomsForm({ onNext }: { onNext: () => void }) {
  const rooms = useWizardStore((state) => state.rooms);
  const patch = useWizardStore((state) => state.patch);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RoomsBulkFormValues>({ resolver: zodResolver(roomsBulkSchema), defaultValues: rooms ?? undefined, mode: 'onTouched' });

  useAutosaveDraft(watch, (values) => patch({ rooms: values }));

  function onSubmit(values: RoomsBulkFormValues) {
    patch({ rooms: values });
    onNext();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <Section label="Rooms">
        <Input
          label="From Room Number"
          type="number"
          hint="e.g. 301"
          {...register('from', { valueAsNumber: true })}
          error={errors.from?.message}
        />
        <Input
          label="To Room Number"
          type="number"
          hint="e.g. 320"
          {...register('to', { valueAsNumber: true })}
          error={errors.to?.message}
        />
        <Input label="Prefix" hint="Optional, e.g. A- → A-301…A-320" {...register('prefix')} error={errors.prefix?.message} />
        <Input label="View" hint="Optional, e.g. sea, garden" {...register('view')} error={errors.view?.message} />
      </Section>

      <Button type="submit" loading={isSubmitting}>
        Continue
      </Button>
    </form>
  );
}
