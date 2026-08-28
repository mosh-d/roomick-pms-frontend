'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Select, type SelectOption } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { CancelReservationIcon } from '@/components/ui/Icons';
import { useReservationsQuery, useCancelReservationMutation, type ReservationSummary } from '@/lib/reservations';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * Cancel Reservation (ref p24), reduced to what `ReservationsService.cancel`
 * actually does: flip a confirmed/waitlisted reservation to `cancelled`
 * with an optional reason. The reference's Cancellation Policy Summary
 * (a static wall of text) and Penalty & Refund calculation (bypass toggle,
 * applied penalty, guest-pays total) both assume a branch-level
 * cancellation-policy concept that doesn't exist in the schema — nothing
 * like `Branch.noShowPolicy` for cancellations. Hardcoding a fake policy
 * or a penalty formula with no real backing data would be worse than not
 * showing one; deferred and named in PHASE_NOTES.md.
 */
export default function CancelReservationPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelledName, setCancelledName] = useState<string | null>(null);

  const confirmedQuery = useReservationsQuery(activeBranchId, { status: 'confirmed' }, auth);
  const waitlistedQuery = useReservationsQuery(activeBranchId, { status: 'waitlisted' }, auth);
  const cancelMutation = useCancelReservationMutation(activeBranchId ?? '', auth);

  const cancellable: ReservationSummary[] = useMemo(
    () => [...(confirmedQuery.data ?? []), ...(waitlistedQuery.data ?? [])],
    [confirmedQuery.data, waitlistedQuery.data],
  );
  const selected = cancellable.find((r) => r.id === selectedId) ?? null;

  const options: SelectOption[] = useMemo(
    () => cancellable.map((r) => ({ value: r.id, label: `${r.guest.name} — ${r.roomType.name} (${r.confirmationNumber})` })),
    [cancellable],
  );

  if (!activeBranchId) return null;

  async function confirmCancel() {
    if (!selected) return;
    setActionError(null);
    try {
      await cancelMutation.mutateAsync({ reservationId: selected.id, reason: reason.trim() || undefined });
      setCancelledName(selected.guest.name);
      setSelectedId(null);
      setReason('');
      setConfirming(false);
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
      setConfirming(false);
    }
  }

  return (
    <Container className="max-w-3xl py-10 flex flex-col gap-6">
      <PageHeader icon={<CancelReservationIcon className="size-8" />} title="Cancel Reservation" subtitle="Handle cancellations" />

      {cancelledName ? <p className="text-body font-semibold text-primary-dark">{cancelledName}&apos;s reservation is cancelled.</p> : null}

      <Section label="Reservation Search">
        {confirmedQuery.isLoading || waitlistedQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading reservations…</p>
        ) : options.length === 0 ? (
          <p className="text-body text-primary-dark/70">No confirmed or waitlisted reservations to cancel.</p>
        ) : (
          <>
            <Select
              id="cancel-reservation"
              name="reservationId"
              label="Reservation"
              options={options}
              value={selectedId}
              onChange={(value) => {
                setSelectedId(value);
                setActionError(null);
                setCancelledName(null);
              }}
            />

            {selected ? (
              <Card tone="secondary" className="flex flex-col gap-2">
                <Row label="Name" value={selected.guest.name} />
                <Row label="Room Type" value={selected.roomType.name} />
                <Row label="Check-In Date" value={new Date(selected.checkInDate).toLocaleDateString()} />
                <Row label="Check-Out Date" value={new Date(selected.checkOutDate).toLocaleDateString()} />
                <Row label="Status" value={selected.status === 'waitlisted' ? 'Waitlisted' : 'Confirmed'} />
              </Card>
            ) : null}

            {selected ? (
              <Textarea label="Reason for Cancellation" value={reason} onChange={(e) => setReason(e.target.value)} hint="Optional — recorded on the reservation for audit" />
            ) : null}

            {actionError ? <p className="text-small text-red-600">{actionError}</p> : null}

            <Button type="button" variant="danger" disabled={!selectedId} onClick={() => setConfirming(true)} className="self-start">
              Confirm Cancellation
            </Button>
          </>
        )}
      </Section>

      <ConfirmDialog
        open={confirming}
        title="Cancel this reservation?"
        description={`This cancels ${selected?.guest.name ?? 'this guest'}'s reservation${selected?.status === 'waitlisted' ? ' and removes them from the waitlist' : ''}. This cannot be undone.`}
        confirmLabel="Confirm Cancellation"
        onCancel={() => setConfirming(false)}
        onConfirm={confirmCancel}
      />
    </Container>
  );
}

/** Inside a `tone="secondary"` card, so these keep the secondary family — see design-system/01-color.md. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-small text-secondary-light">{label}</span>
      <span className="text-body font-semibold text-secondary">{value}</span>
    </div>
  );
}
