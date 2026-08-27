'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, type SelectOption } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { BuildingArrowIcon } from '@/components/ui/Icons';
import { useArrivalsQuery } from '@/lib/reservations';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * Check-In Flow entry point — pick a guest, then continue into their
 * check-in at `/dashboard/check-in/[reservationId]`.
 *
 * This page exists because "Check-In Flow" is its own nav destination and
 * needs a real one. Pointing it at Arrivals (as a first pass did) meant two
 * nav items shared a route and both rendered active — ambiguous. The
 * per-row "Check-In" button on Arrivals still leads to the same place; this
 * is the direct path for someone who came straight to the nav item.
 */
export default function CheckInFlowIndexPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const arrivalsQuery = useArrivalsQuery(activeBranchId, undefined, {
    accessToken: accessToken ?? undefined,
    tenantId: user?.tenantId,
  });

  const options: SelectOption[] = useMemo(
    () =>
      (arrivalsQuery.data ?? []).map((r) => ({
        value: r.id,
        label: `${r.guest.name} — ${r.roomType.name} (${r.confirmationNumber})`,
      })),
    [arrivalsQuery.data],
  );

  const selected = (arrivalsQuery.data ?? []).find((r) => r.id === selectedId) ?? null;

  if (!activeBranchId) return null;

  return (
    <Container className="max-w-3xl py-10 flex flex-col gap-6">
      <PageHeader icon={<BuildingArrowIcon className="size-8" />} title="Check-In Flow" subtitle="Check a guest in" />

      <Section label="Select Guest">
        {arrivalsQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading today&apos;s arrivals…</p>
        ) : arrivalsQuery.isError ? (
          <p className="text-body text-red-600">Could not load arrivals. Please try refreshing.</p>
        ) : options.length === 0 ? (
          <p className="text-body text-primary-dark/70">
            No one is due to arrive today. Walk-In Booking handles a guest with no existing reservation.
          </p>
        ) : (
          <>
            <Select
              id="checkin-guest"
              name="reservationId"
              label="Arriving guest"
              options={options}
              value={selectedId}
              onChange={setSelectedId}
            />

            {selected ? (
              <Card tone="secondary" className="flex flex-col gap-2">
                <Row label="Name" value={selected.guest.name} />
                <Row label="Email" value={selected.guest.email ?? 'NIL'} />
                <Row label="Phone" value={selected.guest.phone ?? 'NIL'} />
                <Row label="Room Type" value={selected.roomType.name} />
                <Row label="Confirmation #" value={selected.confirmationNumber} />
              </Card>
            ) : null}

            <Button
              type="button"
              disabled={!selectedId}
              onClick={() => router.push(`/dashboard/check-in/${selectedId}`)}
              className="self-start"
            >
              Continue to Room Selection
            </Button>
          </>
        )}
      </Section>
    </Container>
  );
}

/** Inside a `tone="secondary"` card, so the label keeps the secondary family — see design-system/01-color.md. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-small text-secondary-light">{label}</span>
      <span className="text-body font-semibold text-secondary">{value}</span>
    </div>
  );
}
