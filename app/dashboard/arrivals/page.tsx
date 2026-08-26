'use client';

import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useArrivalsQuery, type ReservationSummary } from '@/lib/reservations';
import { useAuthStore } from '@/lib/store/authStore';

/** Arrivals Dashboard (Roomick-UI.pdf page 11) — confirmed reservations checking in today. "Check-In" routes to `/dashboard/check-in/[id]` for room assignment, rather than checking in inline — every arrival in this reduced scope has no room yet. */
export default function ArrivalsDashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);

  const arrivalsQuery = useArrivalsQuery(activeBranchId, undefined, { accessToken: accessToken ?? undefined, tenantId: user?.tenantId });

  if (!activeBranchId) return null;

  const columns: TableColumn<ReservationSummary>[] = [
    { key: 'guest', label: 'Name', render: (r) => r.guest.name },
    { key: 'confirmation', label: 'Confirmation #', render: (r) => r.confirmationNumber },
    { key: 'roomType', label: 'Room Type', render: (r) => r.roomType.name },
    { key: 'email', label: 'Email', render: (r) => r.guest.email ?? '—' },
    { key: 'phone', label: 'Phone', render: (r) => r.guest.phone ?? '—' },
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
      <div>
        <h1 className="font-display text-title font-bold text-secondary mb-1">Arrivals Dashboard</h1>
        <p className="text-body text-secondary-light">See guests arriving today</p>
      </div>

      {arrivalsQuery.isLoading ? (
        <p className="text-body text-secondary-light">Loading arrivals…</p>
      ) : arrivalsQuery.isError ? (
        <p className="text-body text-red-600">Could not load arrivals. Please try refreshing.</p>
      ) : (
        <Card tone="secondary">
          <Table columns={columns} rows={arrivalsQuery.data ?? []} emptyMessage="No arrivals scheduled for today." />
        </Card>
      )}
    </Container>
  );
}
