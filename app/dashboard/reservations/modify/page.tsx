'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { ModifyReservationIcon } from '@/components/ui/Icons';
import { modifyReservationSchema, type ModifyReservationFormValues } from '@/lib/schemas/reservations';
import { useRoomTypesQuery } from '@/lib/rooms';
import { useReservationsQuery, useModifyReservationMutation, type ReservationSummary } from '@/lib/reservations';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { dayAfter } from '@/lib/dates';
import { CapacityWarning } from '../../_components/CapacityWarning';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

/** ISO date -> the plain `YYYY-MM-DD` a `type="date"` input needs. */
function toDateInput(iso: string): string {
  return iso.slice(0, 10);
}

/**
 * Modify Reservation (ref p23), reduced to what the backend's
 * `modifyReservation` actually does: dates, room type, party size, on a
 * reservation that hasn't checked in yet. The reference's own Room Change
 * grid (pick a specific room), Rate Plan section, and old-rate/new-rate
 * cost comparison all assume machinery this pass doesn't have (a specific
 * room isn't assigned until check-in in this design; there's no rate-plan
 * resolver) — the live "new total" line below does the one honest version
 * of that comparison this app can actually back up.
 *
 * **A `checked_in` stay can't be modified here** — it already has folio
 * charges posted against its original dates (§4.5's append-only ledger),
 * so changing them needs charge corrections, not a plain field update.
 * Explicitly deferred; see PHASE_NOTES.md.
 */
export default function ModifyReservationPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Confirmed + waitlisted are the only statuses the backend allows here —
  // fetched together and filtered client-side rather than adding a
  // "status in [...]" query param the general search endpoint doesn't
  // support for a two-value set.
  const confirmedQuery = useReservationsQuery(activeBranchId, { status: 'confirmed' }, auth);
  const waitlistedQuery = useReservationsQuery(activeBranchId, { status: 'waitlisted' }, auth);
  const roomTypesQuery = useRoomTypesQuery(activeBranchId, auth);
  const modifyMutation = useModifyReservationMutation(activeBranchId ?? '', auth);

  const modifiable: ReservationSummary[] = useMemo(
    () => [...(confirmedQuery.data ?? []), ...(waitlistedQuery.data ?? [])],
    [confirmedQuery.data, waitlistedQuery.data],
  );
  const selected = modifiable.find((r) => r.id === selectedId) ?? null;

  const reservationOptions: SelectOption[] = useMemo(
    () => modifiable.map((r) => ({ value: r.id, label: `${r.guest.name} — ${r.roomType.name} (${r.confirmationNumber})` })),
    [modifiable],
  );
  const roomTypeOptions: SelectOption[] = useMemo(
    () => (roomTypesQuery.data ?? []).map((rt) => ({ value: rt.id, label: rt.name })),
    [roomTypesQuery.data],
  );

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ModifyReservationFormValues>({ resolver: zodResolver(modifyReservationSchema) });

  // Re-seeds the form fresh every time a DIFFERENT reservation is picked —
  // the same "opening always starts clean" pattern `Select`'s own filter
  // uses, so a half-edited draft from one reservation never bleeds into
  // the next one selected. Keyed on `selectedId` (a stable primitive), not
  // on `selected` itself: a successful save invalidates the confirmed/
  // waitlisted queries, which refetches and hands back a NEW `selected`
  // object for the SAME reservation — depending on that object reference
  // re-ran this effect right after every save, wiping the just-set
  // "Changes saved." message and the reason field a moment after they
  // appeared. Found live, not by inspection.
  useEffect(() => {
    if (!selected) return;
    reset({
      checkInDate: toDateInput(selected.checkInDate),
      checkOutDate: toDateInput(selected.checkOutDate),
      roomTypeId: selected.roomType.id,
      adults: selected.adults,
      children: selected.children,
      reason: '',
    });
    setFormError(null);
    setSuccess(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately NOT depending on `selected` itself; see comment above.
  }, [selectedId, reset]);

  const roomTypeId = watch('roomTypeId');
  const checkInDate = watch('checkInDate');
  const checkOutDate = watch('checkOutDate');

  // Same fix as Create Reservation/Walk-In Booking: moving check-in date
  // later than the currently-set check-out left check-out unchanged and
  // invalid. Never fires right after the reset-on-select effect above —
  // that always seeds a genuinely valid pair from the real reservation.
  useEffect(() => {
    if (!checkInDate) return;
    if (!checkOutDate || checkOutDate <= checkInDate) {
      setValue('checkOutDate', dayAfter(checkInDate));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkInDate]);

  const newRate = useMemo(() => {
    if (!roomTypeId || !checkInDate || !checkOutDate || checkOutDate <= checkInDate) return null;
    const roomType = (roomTypesQuery.data ?? []).find((rt) => rt.id === roomTypeId);
    if (!roomType) return null;
    const nights = Math.round((new Date(checkOutDate).getTime() - new Date(checkInDate).getTime()) / 86_400_000);
    return { nights, total: Number(roomType.baseRate) * nights };
  }, [roomTypeId, checkInDate, checkOutDate, roomTypesQuery.data]);

  if (!activeBranchId) return null;

  async function onSubmit(values: ModifyReservationFormValues) {
    if (!selectedId) return;
    setFormError(null);
    try {
      await modifyMutation.mutateAsync({ reservationId: selectedId, ...values });
      setSuccess(true);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Container className="max-w-3xl py-10 flex flex-col gap-6">
      <PageHeader icon={<ModifyReservationIcon className="size-8" />} title="Modify Reservation" subtitle="Change dates, room types, add extensions and more" />

      <Section label="Reservation Search">
        {confirmedQuery.isLoading || waitlistedQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading reservations…</p>
        ) : reservationOptions.length === 0 ? (
          <p className="text-body text-primary-dark/70">No confirmed or waitlisted reservations to modify.</p>
        ) : (
          <Select
            id="modify-reservation"
            name="reservationId"
            label="Reservation"
            options={reservationOptions}
            value={selectedId}
            onChange={setSelectedId}
          />
        )}
      </Section>

      {selected ? (
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <Section label="Reservation Details">
            <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-start">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                <Controller
                  control={control}
                  name="roomTypeId"
                  render={({ field }) => (
                    <Select name="roomTypeId" label="Room Type" options={roomTypeOptions} value={field.value || null} onChange={field.onChange} error={errors.roomTypeId?.message} />
                  )}
                />
                <div className="hidden sm:block" aria-hidden />
                <Input label="Check-In Date" type="date" {...register('checkInDate')} error={errors.checkInDate?.message} />
                <Input label="Check-Out Date" type="date" {...register('checkOutDate')} error={errors.checkOutDate?.message} />
                <Input label="Adults" type="number" min={1} max={20} {...register('adults', { valueAsNumber: true })} error={errors.adults?.message} />
                <Input label="Children" type="number" min={0} max={20} {...register('children', { valueAsNumber: true })} error={errors.children?.message} />
              </div>
              <CapacityWarning roomType={roomTypesQuery.data?.find((rt) => rt.id === roomTypeId)} adults={watch('adults')} childrenCount={watch('children')} />

              <Card tone="accent" className="flex flex-col gap-2">
                <Row label="Guest" value={selected.guest.name} />
                <Row label="Confirmation #" value={selected.confirmationNumber} />
                <Row label="Current Total" value={formatMoney(selected.confirmedRate, currencySymbolFor(selected.branch.currency))} />
                {newRate ? (
                  <Row label="New Total" value={`${formatMoney(newRate.total, currencySymbolFor(selected.branch.currency))} (${newRate.nights} nights)`} />
                ) : null}
              </Card>
            </div>
          </Section>

          <Section label="Reason">
            <Textarea label="Reason for Change" {...register('reason')} error={errors.reason?.message} hint="Required — recorded on the reservation for audit" />
          </Section>

          {formError ? <p className="text-small text-red-600">{formError}</p> : null}
          {success ? <p className="text-small font-semibold text-primary-dark">Changes saved.</p> : null}

          <Button type="submit" loading={isSubmitting || modifyMutation.isPending} className="self-start">
            Save Changes
          </Button>
        </form>
      ) : null}
    </Container>
  );
}

/** Inside a `tone="accent"` card, so this keeps the accent family — see design-system/01-color.md. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-small text-accent-dark">{label}</span>
      <span className="text-body font-semibold text-primary-dark">{value}</span>
    </div>
  );
}
