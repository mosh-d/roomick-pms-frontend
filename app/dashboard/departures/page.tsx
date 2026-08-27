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
import { useFoliosQuery } from '@/lib/folios';
import { formatMoney } from '@/lib/numberFormat';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * Check-out is NEVER blocked by an outstanding balance — the room has to
 * release either way, and the guest becomes a City Ledger receivable. This
 * dialog therefore *warns* rather than gates, matching the in-house PMS
 * ("you'll see an explicit warning to settle payment first (checkout isn't
 * blocked by it, but you're notified)") and Cloudbeds, whose AR transfer
 * likewise happens after check-out.
 */
function checkOutDescription(pending: { guestName: string; balanceDue: string | null } | null): string {
  const base = `This checks out ${pending?.guestName ?? 'this guest'} and releases the room for cleaning.`;
  const owed = Number(pending?.balanceDue ?? 0);
  if (owed > 0) {
    return `${base} They still owe ${formatMoney(owed)} — settle payment first if you can. Checking out anyway is allowed; the balance becomes a City Ledger receivable.`;
  }
  return `${base} The folio is fully paid and will be settled automatically.`;
}

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
  const [pendingCheckOut, setPendingCheckOut] = useState<{ id: string; guestName: string; balanceDue: string | null } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };
  const departuresQuery = useDeparturesQuery(activeBranchId, undefined, auth);
  const foliosQuery = useFoliosQuery(activeBranchId, 'all', auth);
  const checkOutMutation = useCheckOutMutation(activeBranchId ?? '', auth);

  /** reservationId -> folio balance, so the row and the confirm dialog can both warn about money owed. */
  const folioByReservation = useMemo(() => {
    const map = new Map<string, { id: string; balanceDue: string }>();
    for (const folio of foliosQuery.data ?? []) {
      if (folio.reservation) map.set(folio.reservation.id, { id: folio.id, balanceDue: folio.balanceDue });
    }
    return map;
  }, [foliosQuery.data]);

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
      key: 'folioBalance',
      label: 'Balance',
      align: 'right',
      render: (r) => {
        const folio = folioByReservation.get(r.id);
        if (!folio) return <span className="text-secondary-light">—</span>;
        const owed = Number(folio.balanceDue);
        return <span className={owed > 0 ? 'font-semibold text-red-600' : 'text-secondary-light'}>{formatMoney(folio.balanceDue)}</span>;
      },
      sortValue: (r) => Number(folioByReservation.get(r.id)?.balanceDue ?? 0),
      exportValue: (r) => folioByReservation.get(r.id)?.balanceDue ?? '',
    },
    {
      key: 'action',
      label: 'Action',
      align: 'right',
      render: (r) => (
        <Button
          size="sm"
          onClick={() =>
            setPendingCheckOut({ id: r.id, guestName: r.guest.name, balanceDue: folioByReservation.get(r.id)?.balanceDue ?? null })
          }
        >
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
        description={checkOutDescription(pendingCheckOut)}
        confirmLabel="Check-Out"
        onCancel={() => setPendingCheckOut(null)}
        onConfirm={confirmCheckOut}
      />
    </Container>
  );
}
