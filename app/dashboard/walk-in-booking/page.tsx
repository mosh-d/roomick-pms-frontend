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
import { PageHeader } from '@/components/ui/PageHeader';
import { WalkInIcon } from '@/components/ui/Icons';
import { walkInBookingSchema, type WalkInBookingFormValues } from '@/lib/schemas/reservations';
import { useRoomsQuery, useRoomTypesQuery } from '@/lib/rooms';
import { groupRoomsByFloor } from '@/lib/groupRoomsByFloor';
import { useCreateReservationMutation, useCreateWalkInMutation } from '@/lib/reservations';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';
import { RoomGrid } from '../_components/RoomGrid';
import { RatePreview } from '../_components/RatePreview';

/** Browser-local "today" for the date input's default/min — the backend is the actual authority on "today" (branch timezone, via `todayInTimezone`) and re-derives it server-side for the walk-in path regardless of what's shown here. */
function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Walk-In Booking (Roomick-UI.pdf page 14), reduced to guest + dates + room
 * type (+ room, immediate mode only) — the reference's ID Capture and
 * Payment sections (additional costs, deposit) need ID-document encryption
 * and a payments-at-booking flow, neither built this pass. The rate itself
 * DOES go through the full Rate Resolver cascade now (`RatePreview`,
 * below) — no promo/corporate-account picker on this form yet, though the
 * backend already accepts both.
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
  const checkOutDate = watch('checkOutDate');
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
    <Container className="max-w-5xl py-10 flex flex-col gap-6">
      <PageHeader
        icon={<WalkInIcon className="size-8" />}
        title="Walk-In Booking"
        subtitle={isImmediate ? 'Check an offline guest in now.' : 'Book ahead for a future date — no room assignment yet.'}
      />

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Two-column field pairs, matching the reference's own form layout
            (Roomick-UI.pdf p14 pairs first/last name, email/phone, and the
            date fields side by side) — a single stacked column made this
            form roughly twice as tall as the reference for no benefit. */}
        <Section label="Guest">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            <Input label="Name" {...register('guestName')} error={errors.guestName?.message} />
            <Input label="Email" type="email" {...register('guestEmail')} error={errors.guestEmail?.message} />
            <Input label="Phone" {...register('guestPhone')} error={errors.guestPhone?.message} />
          </div>
        </Section>

        <Section label="Stay">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
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
            <div className="hidden sm:block" aria-hidden />
            <Input label="Check-In Date" type="date" min={today} {...register('checkInDate')} error={errors.checkInDate?.message} />
            <Input label="Check-Out Date" type="date" min={checkInDate || today} {...register('checkOutDate')} error={errors.checkOutDate?.message} />
            <Input label="Adults" type="number" min={1} max={20} {...register('adults', { valueAsNumber: true })} error={errors.adults?.message} />
            <Input label="Children" type="number" min={0} max={20} {...register('children', { valueAsNumber: true })} error={errors.children?.message} />
          </div>
          <Textarea label="Special Requests" {...register('specialRequests')} error={errors.specialRequests?.message} />
          <RatePreview
            branchId={activeBranchId}
            currency={undefined}
            roomTypeId={roomTypeId || null}
            checkInDate={checkInDate || null}
            checkOutDate={checkOutDate || null}
            accessToken={auth.accessToken}
            tenantId={auth.tenantId}
          />
        </Section>

        {isImmediate && roomTypeId ? (
          <Section label="Room Selection">
            {roomsQuery.isLoading ? (
              <p className="text-body text-primary-dark/70">Loading rooms…</p>
            ) : buildings.length === 0 ? (
              <p className="text-body text-primary-dark/70">No ready rooms of this type — nothing vacant and clean/inspected right now.</p>
            ) : (
              <RoomGrid buildings={buildings} selectedRoomId={selectedRoomId} onSelectRoom={setSelectedRoomId} />
            )}
          </Section>
        ) : null}

        {formError ? <p className="text-small text-red-600">{formError}</p> : null}

        <Button type="submit" loading={pending} className="self-start">
          {isImmediate ? 'Confirm Check-In' : 'Book Reservation'}
        </Button>
      </form>
    </Container>
  );
}
