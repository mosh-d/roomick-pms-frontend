'use client';

import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { WaitlistIcon } from '@/components/ui/Icons';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useReservationsQuery, usePromoteFromWaitlistMutation, type ReservationSummary } from '@/lib/reservations';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * Waitlist Management (ref p10 card) — every reservation booked via Create
 * Reservation's "Join the Waitlist Instead" path. "Promote" re-checks
 * availability right now and confirms the reservation if a room has
 * opened up; if nothing has, the row stays put and says so rather than
 * pretending the action did something.
 */
export default function WaitlistManagementPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const waitlistQuery = useReservationsQuery(activeBranchId, { status: 'waitlisted' }, auth);
  const promoteMutation = usePromoteFromWaitlistMutation(activeBranchId ?? '', auth);

  if (!activeBranchId) return null;

  async function promote(reservationId: string) {
    setRowError(null);
    try {
      await promoteMutation.mutateAsync(reservationId);
    } catch (error) {
      setRowError({
        id: reservationId,
        message: error instanceof ApiError && error.isCode('RESERVATION_NOT_AVAILABLE')
          ? 'Still no rooms of this type available for these dates.'
          : error instanceof ApiError
            ? error.message
            : 'Something went wrong. Please try again.',
      });
    }
  }

  const columns: TableColumn<ReservationSummary>[] = [
    { key: 'guest', label: 'Name', render: (r) => r.guest.name, sortValue: (r) => r.guest.name },
    { key: 'roomType', label: 'Room Type', render: (r) => r.roomType.name, sortValue: (r) => r.roomType.name },
    {
      key: 'checkInDate',
      label: 'Check-In Date',
      render: (r) => new Date(r.checkInDate).toLocaleDateString(),
      sortValue: (r) => r.checkInDate,
    },
    {
      key: 'checkOutDate',
      label: 'Check-Out Date',
      render: (r) => new Date(r.checkOutDate).toLocaleDateString(),
      sortValue: (r) => r.checkOutDate,
    },
    { key: 'confirmation', label: 'Confirmation #', render: (r) => r.confirmationNumber, sortValue: (r) => r.confirmationNumber },
    {
      key: 'action',
      label: 'Action',
      align: 'right',
      render: (r) => (
        <div className="flex flex-col items-end gap-1">
          <Button size="sm" loading={promoteMutation.isPending} onClick={() => promote(r.id)}>
            Promote
          </Button>
          {rowError?.id === r.id ? <span className="text-tiny text-red-600">{rowError.message}</span> : null}
        </div>
      ),
    },
  ];

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-6">
      <PageHeader icon={<WaitlistIcon className="size-8" />} title="Waitlist Management" subtitle="Future bookings, earliest availability" />

      {waitlistQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading waitlist…</p>
      ) : waitlistQuery.isError ? (
        <p className="text-body text-red-600">Could not load the waitlist. Please try refreshing.</p>
      ) : (
        <Card tone="secondary">
          <Table
            columns={columns}
            rows={waitlistQuery.data ?? []}
            emptyMessage="No reservations on the waitlist."
            exportFileName="waitlist"
          />
        </Card>
      )}
    </Container>
  );
}
