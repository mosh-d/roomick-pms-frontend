'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { PlaneTakeoffIcon } from '@/components/ui/Icons';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useDeparturesQuery, useCheckOutMutation, type ReservationSummary } from '@/lib/reservations';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * Departures Dashboard (Roomick-UI.pdf page 15) — checked-in reservations
 * checking out today. No dedicated Check-Out Flow page this pass: the
 * reference's version (p16) is built entirely around a folio line-item
 * list and a final-payment step, and Folios/Payments aren't built. A
 * `ConfirmDialog` is the whole check-out UX, and its copy says so rather
 * than pretending a balance was settled.
 */
export default function DeparturesDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const [pendingCheckOut, setPendingCheckOut] = useState<{ id: string; guestName: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const departuresQuery = useDeparturesQuery(activeBranchId, undefined, { accessToken: accessToken ?? undefined, tenantId: user?.tenantId });
  const checkOutMutation = useCheckOutMutation(activeBranchId ?? '', { accessToken: accessToken ?? undefined, tenantId: user?.tenantId });

  const rows = useMemo(() => {
    const all = departuresQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) => r.guest.name.toLowerCase().includes(q) || (r.room?.number ?? '').toLowerCase().includes(q) || r.confirmationNumber.toLowerCase().includes(q));
  }, [departuresQuery.data, search]);

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
    { key: 'guest', label: 'Name', render: (r) => r.guest.name, sortValue: (r) => r.guest.name },
    { key: 'room', label: 'Room', render: (r) => r.room?.number ?? '—', sortValue: (r) => r.room?.number ?? '' },
    { key: 'confirmation', label: 'Confirmation #', render: (r) => r.confirmationNumber, sortValue: (r) => r.confirmationNumber },
    {
      key: 'checkOutDate',
      label: 'Check-Out Date',
      render: (r) => new Date(r.checkOutDate).toLocaleDateString(),
      sortValue: (r) => r.checkOutDate,
    },
    {
      key: 'status',
      label: 'Status',
      render: () => <span className="text-primary-text font-semibold">Due Out</span>,
      sortValue: () => 'Due Out',
    },
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
      <PageHeader icon={<PlaneTakeoffIcon className="size-8" />} title="Departures Dashboard" subtitle="Today's expected departures" />

      <SearchInput label="Search departures by guest name or room" placeholder="Search by guest name" value={search} onChange={setSearch} />

      {actionError ? <p className="text-small text-red-600">{actionError}</p> : null}

      {departuresQuery.isLoading ? (
        <p className="text-body text-secondary-light">Loading departures…</p>
      ) : departuresQuery.isError ? (
        <p className="text-body text-red-600">Could not load departures. Please try refreshing.</p>
      ) : (
        <Card tone="secondary">
          <Table
            columns={columns}
            rows={rows}
            emptyMessage={search ? 'No departures match that search.' : 'No departures scheduled for today.'}
            exportFileName="departures"
          />
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
