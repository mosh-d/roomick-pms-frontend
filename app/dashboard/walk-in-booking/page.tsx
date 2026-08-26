'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { walkInBookingSchema, type WalkInBookingFormValues } from '@/lib/schemas/reservations';
import { useRoomsQuery, useRoomTypesQuery } from '@/lib/rooms';
import { groupRoomsByFloor } from '@/lib/groupRoomsByFloor';
import { useCreateReservationMutation, useCreateWalkInMutation } from '@/lib/reservations';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';
import { RoomGrid } from '../_components/RoomGrid';

/** Browser-local "today" for the date input's default/min — the backend is the actual authority on "today" (branch timezone, via `todayInTimezone`) and re-derives it server-side for the walk-in path regardless of what's shown here. */
function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Walk-In Booking (Roomick-UI.pdf page 14), reduced to guest + dates + room
 * type (+ room, immediate mode only) — the reference's ID Capture and
 * Payment sections (rate plan/promo code, additional costs, deposit) need
 * ID-document encryption and the full Rate Resolver/Folios stack, neither
 * built this pass.
 *
 * Dual-mode, not a separate route: this is the only place a `Reservation`
 * gets created, so if walk-in (create + immediate check-in) were the only
 * path, nothing would ever sit in `confirmed` waiting on Arrivals — the
 * whole rest of the feature would be unreachable through the UI. Mode is
 * derived from the picked check-in date, not a separate toggle: today =
 * immediate (room picker shown, submits to the walk-in endpoint), any
 * future date = book-ahead (room-type inventory only, submits to plain
 * reservation create).
 */
export default function WalkInBookingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const today = todayString();
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<WalkInBookingFormValues>({
    resolver: zodResolver(walkInBookingSchema),
    defaultValues: { checkInDate: today, adults: 1, children: 0 },
  });

  const checkInDate = watch('checkInDate');
  const roomTypeId = watch('roomTypeId');
  const isImmediate = checkInDate === today;

  const roomTypesQuery = useRoomTypesQuery(activeBranchId, auth);
  const roomsQuery = useRoomsQuery(activeBranchId, auth);
  const createReservationMutation = useCreateReservationMutation(activeBranchId ?? '', auth);
  const createWalkInMutation = useCreateWalkInMutation(activeBranchId ?? '', auth);

  const roomTypeOptions: SelectOption[] = useMemo(
    () => (roomTypesQuery.data ?? []).map((rt) => ({ value: rt.id, label: rt.name })),
    [roomTypesQuery.data],
  );

  const readyRooms = useMemo(() => {
    if (!isImmediate || !roomTypeId) return [];
    return (roomsQuery.data ?? []).filter(
      (room) =>
        room.roomType.id === roomTypeId &&
        room.occupancyStatus === 'vacant' &&
        room.heldStatus === null &&
        (['clean', 'inspected'] as string[]).includes(room.cleanlinessStatus),
    );
  }, [roomsQuery.data, roomTypeId, isImmediate]);

  const buildings = useMemo(() => groupRoomsByFloor(readyRooms), [readyRooms]);

  // A room type change (or switching modes) invalidates whatever room was picked for the previous type.
  useEffect(() => {
    setSelectedRoomId(null);
  }, [roomTypeId, isImmediate]);

  if (!activeBranchId) return null;

  async function onSubmit(values: WalkInBookingFormValues) {
    setFormError(null);
    const guest = { name: values.guestName, email: values.guestEmail || undefined, phone: values.guestPhone || undefined };
    try {
      if (isImmediate) {
        if (!selectedRoomId) {
          setFormError('Pick a room to check the guest in now.');
          return;
        }
        await createWalkInMutation.mutateAsync({
          guest,
          roomTypeId: values.roomTypeId,
          roomId: selectedRoomId,
          checkOutDate: values.checkOutDate,
          adults: values.adults,
          children: values.children,
          specialRequests: values.specialRequests || undefined,
        });
      } else {
        await createReservationMutation.mutateAsync({
          guest,
          roomTypeId: values.roomTypeId,
          checkInDate: values.checkInDate,
          checkOutDate: values.checkOutDate,
          adults: values.adults,
          children: values.children,
          specialRequests: values.specialRequests || undefined,
          channel: 'direct',
        });
      }
      router.push(isImmediate ? '/dashboard/room-status-board' : '/dashboard/arrivals');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  const pending = isSubmitting || createReservationMutation.isPending || createWalkInMutation.isPending;

  return (
    <Container className="max-w-3xl py-10 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-title font-bold text-secondary mb-1">Walk-In Booking</h1>
        <p className="text-body text-secondary-light">
          {isImmediate ? 'Check an offline guest in now.' : 'Book ahead for a future date — no room assignment yet.'}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Section label="Guest">
          <Input label="Name" {...register('guestName')} error={errors.guestName?.message} />
          <Input label="Email" type="email" {...register('guestEmail')} error={errors.guestEmail?.message} />
          <Input label="Phone" {...register('guestPhone')} error={errors.guestPhone?.message} />
        </Section>

        <Section label="Stay">
          <Controller
            control={control}
            name="roomTypeId"
            render={({ field }) => (
              <Select
                name="roomTypeId"
                label="Room Type"
                options={roomTypeOptions}
                value={field.value || null}
                onChange={field.onChange}
                error={errors.roomTypeId?.message}
              />
            )}
          />
          <Input label="Check-In Date" type="date" min={today} {...register('checkInDate')} error={errors.checkInDate?.message} />
          <Input label="Check-Out Date" type="date" min={checkInDate || today} {...register('checkOutDate')} error={errors.checkOutDate?.message} />
          <Input label="Adults" type="number" min={1} max={20} {...register('adults', { valueAsNumber: true })} error={errors.adults?.message} />
          <Input label="Children" type="number" min={0} max={20} {...register('children', { valueAsNumber: true })} error={errors.children?.message} />
          <Textarea label="Special Requests" {...register('specialRequests')} error={errors.specialRequests?.message} />
        </Section>

        {isImmediate && roomTypeId ? (
          <div>
            <h2 className="text-body font-bold text-secondary mb-3">Room Selection</h2>
            {roomsQuery.isLoading ? (
              <p className="text-body text-secondary-light">Loading rooms…</p>
            ) : buildings.length === 0 ? (
              <p className="text-body text-secondary-light">No ready rooms of this type — nothing vacant and clean/inspected right now.</p>
            ) : (
              <RoomGrid buildings={buildings} selectedRoomId={selectedRoomId} onSelectRoom={setSelectedRoomId} />
            )}
          </div>
        ) : null}

        {formError ? <p className="text-small text-red-600">{formError}</p> : null}

        <Button type="submit" loading={pending} className="self-start">
          {isImmediate ? 'Confirm Check-In' : 'Book Reservation'}
        </Button>
      </form>
    </Container>
  );
}
