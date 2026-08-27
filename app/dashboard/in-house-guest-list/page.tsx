'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { ClipboardListIcon } from '@/components/ui/Icons';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useInHouseQuery, type ReservationSummary } from '@/lib/reservations';
import { useFoliosQuery } from '@/lib/folios';
import { formatMoney } from '@/lib/numberFormat';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * In-House Guest List (Roomick-UI.pdf page 18) — every currently
 * checked-in guest, with the reference's Folio Balance column and View
 * Folio action (both unblocked once Folios/Payments landed). Still not
 * built: "Group" and the VIP badge, which need `GuestProfile` fields this
 * pass deliberately excludes.
 *
 * Balances come from the branch folio list rather than a per-row fetch —
 * one request for the whole table instead of N.
 */
export default function InHouseGuestListPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const [search, setSearch] = useState('');
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const inHouseQuery = useInHouseQuery(activeBranchId, auth);
  const foliosQuery = useFoliosQuery(activeBranchId, 'all', auth);

  /** reservationId -> its folio, so each row can show a live balance and link straight to it. */
  const folioByReservation = useMemo(() => {
    const map = new Map<string, { id: string; balanceDue: string }>();
    for (const folio of foliosQuery.data ?? []) {
      if (folio.reservation) map.set(folio.reservation.id, { id: folio.id, balanceDue: folio.balanceDue });
    }
    return map;
  }, [foliosQuery.data]);

  const rows = useMemo(() => {
    const all = inHouseQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) => r.guest.name.toLowerCase().includes(q) || (r.room?.number ?? '').toLowerCase().includes(q) || r.roomType.name.toLowerCase().includes(q));
  }, [inHouseQuery.data, search]);

  if (!activeBranchId) return null;

  const columns: TableColumn<ReservationSummary>[] = [
    { key: 'guest', label: 'Name', render: (r) => r.guest.name, sortValue: (r) => r.guest.name },
    { key: 'room', label: 'Room', render: (r) => r.room?.number ?? '—', sortValue: (r) => r.room?.number ?? '' },
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
    {
      key: 'folioBalance',
      label: 'Folio Balance',
      align: 'right',
      render: (r) => {
        const folio = folioByReservation.get(r.id);
        if (!folio) return <span className="text-secondary-light">—</span>;
        const owed = Number(folio.balanceDue);
        return (
          <span className={owed > 0 ? 'font-semibold text-red-600' : owed < 0 ? 'font-semibold text-green-700' : 'text-secondary-light'}>
            {formatMoney(folio.balanceDue)}
          </span>
        );
      },
      sortValue: (r) => Number(folioByReservation.get(r.id)?.balanceDue ?? 0),
      exportValue: (r) => folioByReservation.get(r.id)?.balanceDue ?? '',
    },
    {
      key: 'action',
      label: 'Action',
      align: 'right',
      render: (r) => {
        const folio = folioByReservation.get(r.id);
        if (!folio) return <span className="text-secondary-light">—</span>;
        return (
          <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/billing/${folio.id}`)}>
            View Folio
          </Button>
        );
      },
    },
  ];

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-6">
      <PageHeader icon={<ClipboardListIcon className="size-8" />} title="In-House Guest List" subtitle="See all currently checked-in guests" />

      <SearchInput label="Search in-house guests by name or room" placeholder="Search by guest name" value={search} onChange={setSearch} />

      {inHouseQuery.isLoading ? (
        <p className="text-body text-secondary-light">Loading guests…</p>
      ) : inHouseQuery.isError ? (
        <p className="text-body text-red-600">Could not load guests. Please try refreshing.</p>
      ) : (
        <Card tone="secondary">
          <Table
            columns={columns}
            rows={rows}
            emptyMessage={search ? 'No guests match that search.' : 'No guests currently checked in.'}
            exportFileName="in-house-guests"
          />
        </Card>
      )}
    </Container>
  );
}
