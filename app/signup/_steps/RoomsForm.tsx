'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { apiFetch, ApiError } from '@/lib/api';
import { roomsBulkSchema, type RoomsBulkFormValues } from '@/lib/schemas/onboarding';
import { useAuthStore } from '@/lib/store/authStore';

export type RoomsBulkResponse = Array<{ id: string; number: string }>;

/**
 * Onboarding step 4b (Roomick-UI.pdf "Rooms") — property/dto/rooms.dto.ts's
 * BulkCreateRoomsDto, range variant only (e.g. 301-320); the explicit-
 * numbers variant and per-room floor assignment are deferred (see
 * PHASE_NOTES.md and roomTypeSchema's comment on the same trade-off).
 * `floorId` is omitted entirely — the backend auto-creates a hidden default
 * building/floor for this, its own documented "Rooms Only" onboarding mode.
 */
export function RoomsForm({
  branchId,
  roomTypeId,
  onSuccess,
}: {
  branchId: string;
  roomTypeId: string;
  onSuccess: (rooms: RoomsBulkResponse) => void;
}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const tenantId = useAuthStore((state) => state.user?.tenantId);
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RoomsBulkFormValues>({ resolver: zodResolver(roomsBulkSchema) });

  async function onSubmit(values: RoomsBulkFormValues) {
    setFormError(null);
    try {
      const rooms = await apiFetch<RoomsBulkResponse>(`/branches/${branchId}/rooms/bulk`, {
        method: 'POST',
        accessToken: accessToken ?? undefined,
        tenantId,
        body: {
          roomTypeId,
          range: { from: values.from, to: values.to, prefix: values.prefix || undefined },
          view: values.view || undefined,
        },
      });
      onSuccess(rooms);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
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

      {formError ? <p className="text-small text-red-600">{formError}</p> : null}

      <Button type="submit" loading={isSubmitting}>
        Create rooms
      </Button>
    </form>
  );
}
