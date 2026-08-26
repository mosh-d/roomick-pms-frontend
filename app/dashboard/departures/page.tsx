'use client';

import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useDeparturesQuery, useCheckOutMutation, type ReservationSummary } from '@/lib/reservations';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * Departures Dashboard (Roomick-UI.pdf page 15) — checked-in reservations
 * checking out today. No dedicated Check-Out Flow page this pass — a
 * `ConfirmDialog` is the entire check-out UX, since there's no folio to
 * review yet (Folios/Payments aren't built). The dialog copy says so
 * explicitly rather than silently pretending a balance was settled.
 */
export default function DeparturesDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const [pendingCheckOut, setPendingCheckOut] = useState<{ id: string; guestName: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const departuresQuery = useDeparturesQuery(activeBranchId, undefined, { accessToken: accessToken ?? undefined, tenantId: user?.tenantId });
  const checkOutMutation = useCheckOutMutation(activeBranchId ?? '', { accessToken: accessToken ?? undefined, tenantId: user?.tenantId });

  if (!activeBranchId) return null;

  async function confirmCheckOut() {
    if (!pendingCheckOut) return;
    setActionError(null);
    try {
      await checkOutMutation.mutateAsync(pendingCheckOut.id);
      setPendingCheckOut(null);
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  const columns: TableColumn<ReservationSummary>[] = [
    { key: 'guest', label: 'Name', render: (r) => r.guest.name },
    { key: 'room', label: 'Room', render: (r) => r.room?.number ?? '—' },
    { key: 'confirmation', label: 'Confirmation #', render: (r) => r.confirmationNumber },
    { key: 'checkOutDate', label: 'Check-Out Date', render: (r) => new Date(r.checkOutDate).toLocaleDateString() },
    {
      key: 'action',
      label: 'Action',
      align: 'right',
      render: (r) => (
        <Button size="sm" onClick={() => setPendingCheckOut({ id: r.id, guestName: r.guest.name })}>
          Check-Out
        </Button>
      ),
    },
  ];

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-title font-bold text-secondary mb-1">Departures Dashboard</h1>
        <p className="text-body text-secondary-light">Today&apos;s expected departures, folio status</p>
      </div>

      {actionError ? <p className="text-small text-red-600">{actionError}</p> : null}

      {departuresQuery.isLoading ? (
        <p className="text-body text-secondary-light">Loading departures…</p>
      ) : departuresQuery.isError ? (
        <p className="text-body text-red-600">Could not load departures. Please try refreshing.</p>
      ) : (
        <Card tone="secondary">
          <Table columns={columns} rows={departuresQuery.data ?? []} emptyMessage="No departures scheduled for today." />
        </Card>
      )}

      <ConfirmDialog
        open={pendingCheckOut !== null}
        title="Check out this guest?"
        description={`This checks out ${pendingCheckOut?.guestName} and releases the room for cleaning. This does not settle any charges — billing isn't available yet.`}
        confirmLabel="Check-Out"
        onCancel={() => setPendingCheckOut(null)}
        onConfirm={confirmCheckOut}
      />
    </Container>
  );
}
