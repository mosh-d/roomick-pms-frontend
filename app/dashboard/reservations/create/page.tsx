'use client';

import { useMemo, useState } from 'react';
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
import { CreateReservationIcon } from '@/components/ui/Icons';
import { createReservationSchema, type CreateReservationFormValues } from '@/lib/schemas/reservations';
import { useRoomTypesQuery } from '@/lib/rooms';
import { useCreateReservationMutation } from '@/lib/reservations';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * Create Reservation (ref p22), reduced to an individual advance booking —
 * guest, room type, dates, party size. The reference's own card says
 * "Individual, group, multi-room"; group/multi-room bookings, ID capture,
 * a rate-plan picker, and payment/deposit collection at booking time are
 * each a real subsystem the backend doesn't have yet (group reservations,
 * encrypted ID-document storage, the rate resolver cascade, a payments-at-
 * booking flow) — building a form for them would be UI over nothing.
 *
 * This does the same job Walk-In Booking's own "book ahead" branch
 * already does (same `createReservation` call, same flat-rate pricing) —
 * duplicated here as its own page, not extracted into a shared component,
 * because the two only look similar today: Walk-In Booking's dual
 * immediate/future toggle and room picker don't belong on a Reservations-
 * module page, and this page's waitlist path doesn't belong on Walk-In
 * Booking's. Genuinely different pages that happen to share a backend call.
 */
export default function CreateReservationPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const today = todayString();
  const [formError, setFormError] = useState<string | null>(null);
  const [offerWaitlist, setOfferWaitlist] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<CreateReservationFormValues>({
    resolver: zodResolver(createReservationSchema),
    defaultValues: { checkInDate: today, adults: 1, children: 0 },
  });

  const roomTypesQuery = useRoomTypesQuery(activeBranchId, auth);
  const createMutation = useCreateReservationMutation(activeBranchId ?? '', auth);

  const roomTypeOptions: SelectOption[] = useMemo(
    () => (roomTypesQuery.data ?? []).map((rt) => ({ value: rt.id, label: rt.name })),
    [roomTypesQuery.data],
  );

  if (!activeBranchId) return null;

  async function submit(values: CreateReservationFormValues, joinWaitlist: boolean) {
    setFormError(null);
    setOfferWaitlist(false);
    try {
      await createMutation.mutateAsync({
        guest: { name: values.guestName, email: values.guestEmail || undefined, phone: values.guestPhone || undefined },
        roomTypeId: values.roomTypeId,
        checkInDate: values.checkInDate,
        checkOutDate: values.checkOutDate,
        adults: values.adults,
        children: values.children,
        specialRequests: values.specialRequests || undefined,
        channel: 'direct',
        joinWaitlist,
      });
      router.push(joinWaitlist ? '/dashboard/reservations/waitlist' : '/dashboard/arrivals');
    } catch (error) {
      if (error instanceof ApiError && error.isCode('RESERVATION_NOT_AVAILABLE')) {
        setOfferWaitlist(true);
        setFormError('No rooms of this type are available for the full requested stay.');
        return;
      }
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  const pending = isSubmitting || createMutation.isPending;

  return (
    <Container className="max-w-3xl py-10 flex flex-col gap-6">
      <PageHeader icon={<CreateReservationIcon className="size-8" />} title="Create Reservation" subtitle="Book an individual reservation" />

      <form onSubmit={handleSubmit((values) => submit(values, false))} className="flex flex-col gap-4">
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
            <Input label="Check-Out Date" type="date" min={today} {...register('checkOutDate')} error={errors.checkOutDate?.message} />
            <Input label="Adults" type="number" min={1} max={20} {...register('adults', { valueAsNumber: true })} error={errors.adults?.message} />
            <Input label="Children" type="number" min={0} max={20} {...register('children', { valueAsNumber: true })} error={errors.children?.message} />
          </div>
          <Textarea label="Special Requests" {...register('specialRequests')} error={errors.specialRequests?.message} />
        </Section>

        {formError ? (
          <div className="flex flex-col gap-2">
            <p className="text-small text-red-600">{formError}</p>
            {offerWaitlist ? (
              <Button
                type="button"
                variant="outline"
                loading={pending}
                onClick={() => submit(getValues(), true)}
                className="self-start"
              >
                Join the Waitlist Instead
              </Button>
            ) : null}
          </div>
        ) : null}

        <Button type="submit" loading={pending} className="self-start">
          Book Reservation
        </Button>
      </form>
    </Container>
  );
}
