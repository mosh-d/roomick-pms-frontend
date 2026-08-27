'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { ClipboardListIcon } from '@/components/ui/Icons';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useInHouseQuery, type ReservationSummary } from '@/lib/reservations';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * In-House Guest List (Roomick-UI.pdf page 18) — every currently
 * checked-in guest. Reference columns not built: "Folio Balance" and the
 * "View Folio" action (both need Folios/Payments, P4), "Group" and the VIP
 * badge (both need `GuestProfile` fields this pass deliberately excludes).
 */
export default function InHouseGuestListPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const [search, setSearch] = useState('');

  const inHouseQuery = useInHouseQuery(activeBranchId, { accessToken: accessToken ?? undefined, tenantId: user?.tenantId });

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
