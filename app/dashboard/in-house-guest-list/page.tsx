'use client';

import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useInHouseQuery, type ReservationSummary } from '@/lib/reservations';
import { useAuthStore } from '@/lib/store/authStore';

/** In-House Guest List (Roomick-UI.pdf page 18) — every currently checked-in guest. The reference's Folio Balance/Group columns need Folios/Payments (not built) — trimmed to what's real. */
export default function InHouseGuestListPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);

  const inHouseQuery = useInHouseQuery(activeBranchId, { accessToken: accessToken ?? undefined, tenantId: user?.tenantId });

  if (!activeBranchId) return null;

  const columns: TableColumn<ReservationSummary>[] = [
    { key: 'guest', label: 'Name', render: (r) => r.guest.name },
    { key: 'room', label: 'Room', render: (r) => r.room?.number ?? '—' },
    { key: 'roomType', label: 'Room Type', render: (r) => r.roomType.name },
    { key: 'checkInDate', label: 'Check-In Date', render: (r) => new Date(r.checkInDate).toLocaleDateString() },
    { key: 'checkOutDate', label: 'Check-Out Date', render: (r) => new Date(r.checkOutDate).toLocaleDateString() },
  ];

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-title font-bold text-secondary mb-1">In-House Guest List</h1>
        <p className="text-body text-secondary-light">All currently checked-in guests</p>
      </div>

      {inHouseQuery.isLoading ? (
        <p className="text-body text-secondary-light">Loading guests…</p>
      ) : inHouseQuery.isError ? (
        <p className="text-body text-red-600">Could not load guests. Please try refreshing.</p>
      ) : (
        <Card tone="secondary">
          <Table columns={columns} rows={inHouseQuery.data ?? []} emptyMessage="No guests currently checked in." />
        </Card>
      )}
    </Container>
  );
}
