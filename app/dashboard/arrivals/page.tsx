'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { PlaneLandingIcon } from '@/components/ui/Icons';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useArrivalsQuery, type ReservationSummary } from '@/lib/reservations';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * Arrivals Dashboard (Roomick-UI.pdf page 11) — confirmed reservations
 * checking in today. "Check-In" routes to `/dashboard/check-in/[id]` for
 * room assignment rather than checking in inline: in this design a room is
 * only ever assigned AT check-in, so every arrival needs the picker.
 *
 * Reference columns not built: "Room" (always unassigned pre-check-in
 * here, so the column would be a wall of dashes — see PHASE_NOTES on the
 * assign-at-check-in decision), "Group" and the VIP badge (both need
 * `GuestProfile` fields this pass deliberately excludes).
 */
export default function ArrivalsDashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const [search, setSearch] = useState('');

  const arrivalsQuery = useArrivalsQuery(activeBranchId, undefined, { accessToken: accessToken ?? undefined, tenantId: user?.tenantId });

  const rows = useMemo(() => {
    const all = arrivalsQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (r) => r.guest.name.toLowerCase().includes(q) || (r.guest.email ?? '').toLowerCase().includes(q) || r.confirmationNumber.toLowerCase().includes(q),
    );
  }, [arrivalsQuery.data, search]);

  if (!activeBranchId) return null;

  const columns: TableColumn<ReservationSummary>[] = [
    { key: 'guest', label: 'Name', render: (r) => r.guest.name, sortValue: (r) => r.guest.name },
    { key: 'confirmation', label: 'Confirmation #', render: (r) => r.confirmationNumber, sortValue: (r) => r.confirmationNumber },
    { key: 'roomType', label: 'Room Type', render: (r) => r.roomType.name, sortValue: (r) => r.roomType.name },
    { key: 'email', label: 'Email', render: (r) => r.guest.email ?? '—', sortValue: (r) => r.guest.email ?? '' },
    { key: 'phone', label: 'Phone No', render: (r) => r.guest.phone ?? '—', sortValue: (r) => r.guest.phone ?? '' },
    {
      key: 'status',
      label: 'Status',
      render: () => <span className="text-primary-text font-semibold">Pending Check-In</span>,
      sortValue: () => 'Pending Check-In',
    },
    {
      key: 'action',
      label: 'Action',
      align: 'right',
      render: (r) => (
        <Button size="sm" onClick={() => router.push(`/dashboard/check-in/${r.id}`)}>
          Check-In
        </Button>
      ),
    },
  ];

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-6">
      <PageHeader icon={<PlaneLandingIcon className="size-8" />} title="Arrivals Dashboard" subtitle="See guests arriving today" />

      <SearchInput label="Search arrivals by guest name" placeholder="Search by guest name" value={search} onChange={setSearch} />

      {arrivalsQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading arrivals…</p>
      ) : arrivalsQuery.isError ? (
        <p className="text-body text-red-600">Could not load arrivals. Please try refreshing.</p>
      ) : (
        <Card tone="secondary">
          <Table
            columns={columns}
            rows={rows}
            emptyMessage={search ? 'No arrivals match that search.' : 'No arrivals scheduled for today.'}
            exportFileName="arrivals"
          />
        </Card>
      )}
    </Container>
  );
}
