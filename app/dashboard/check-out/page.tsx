'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Select, type SelectOption } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { HotelCheckOutIcon } from '@/components/ui/Icons';
import { useInHouseQuery } from '@/lib/reservations';
import { useFoliosQuery } from '@/lib/folios';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { useAuthStore } from '@/lib/store/authStore';
import { formatDateOnly } from '@/lib/dates';
import { CheckOutDialog } from '../_components/CheckOutDialog';

/**
 * Check-Out Flow (Roomick-UI.pdf page 16) — pick an in-house guest, review
 * what they owe, check them out.
 *
 * Deliberately lists ALL in-house guests, not just today's departures: an
 * early check-out is a real front-desk event and the Departures Dashboard
 * (which is date-scoped) can't serve it. That's also what makes this a
 * distinct destination from Departures rather than a second route onto the
 * same list.
 *
 * An outstanding balance NEVER blocks check-out — the room has to release
 * either way and the balance becomes a City Ledger receivable. So the
 * balance is shown as a warning with a link into the folio, never as a gate.
 */
export default function CheckOutFlowPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [checkedOutName, setCheckedOutName] = useState<string | null>(null);

  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };
  const inHouseQuery = useInHouseQuery(activeBranchId, auth);
  const foliosQuery = useFoliosQuery(activeBranchId, 'in_house', auth);

  /** reservationId -> folio, so the selected guest's live balance can be shown before committing. */
  const folioByReservation = useMemo(() => {
    const map = new Map<string, { id: string; balanceDue: string; currency: string }>();
    for (const folio of foliosQuery.data ?? []) {
      if (folio.reservation) map.set(folio.reservation.id, { id: folio.id, balanceDue: folio.balanceDue, currency: folio.currency });
    }
    return map;
  }, [foliosQuery.data]);

  const options: SelectOption[] = useMemo(
    () =>
      (inHouseQuery.data ?? []).map((r) => ({
        value: r.id,
        label: `${r.guest.name} — Room ${r.room?.number ?? '—'} (${r.confirmationNumber})`,
      })),
    [inHouseQuery.data],
  );

  const selected = (inHouseQuery.data ?? []).find((r) => r.id === selectedId) ?? null;
  const folio = selectedId ? (folioByReservation.get(selectedId) ?? null) : null;
  const owed = Number(folio?.balanceDue ?? 0);

  if (!activeBranchId) return null;

  return (
    <Container className="max-w-3xl py-10 flex flex-col gap-6">
      <PageHeader icon={<HotelCheckOutIcon className="size-8" />} title="Check-Out Flow" subtitle="Settle up and release the room" />

      {checkedOutName ? (
        <p className="text-body font-semibold text-surface">
          {checkedOutName} is checked out. The room is now vacant and marked dirty for housekeeping.
        </p>
      ) : null}

      <Section label="Select Guest">
        {inHouseQuery.isLoading ? (
          <p className="text-body text-surface-muted">Loading in-house guests…</p>
        ) : inHouseQuery.isError ? (
          <p className="text-body text-red-600">Could not load in-house guests. Please try refreshing.</p>
        ) : options.length === 0 ? (
          <p className="text-body text-surface-muted">No guests are currently in-house.</p>
        ) : (
          <>
            <Select
              id="checkout-guest"
              name="reservationId"
              label="In-house guest"
              options={options}
              value={selectedId}
              onChange={(value) => {
                setSelectedId(value);
                setCheckedOutName(null);
              }}
            />

            {selected ? (
              <Card tone="secondary" className="flex flex-col gap-2">
                <Row label="Name" value={selected.guest.name} />
                <Row label="Room" value={selected.room?.number ?? '—'} />
                <Row label="Confirmation #" value={selected.confirmationNumber} />
                <Row label="Departing" value={formatDateOnly(selected.checkOutDate)} />
                <Row
                  label="Balance Due"
                  value={folio ? formatMoney(folio.balanceDue, currencySymbolFor(folio.currency)) : '—'}
                  emphasis={owed > 0 ? 'owed' : undefined}
                />
              </Card>
            ) : null}

            {selected && owed > 0 ? (
              <p className="text-small text-surface">
                This guest still owes a balance. Checking out is still allowed — it becomes a City Ledger receivable — but
                you can{' '}
                <Link href={`/dashboard/billing/${folio?.id}`} className="font-semibold text-surface-accent underline">
                  settle it in the folio
                </Link>{' '}
                first.
              </p>
            ) : null}

            <Button type="button" disabled={!selectedId} onClick={() => setConfirming(true)} className="self-start">
              Complete Check-Out
            </Button>
          </>
        )}
      </Section>

      <CheckOutDialog
        target={confirming && selected ? { id: selected.id, guestName: selected.guest.name, balanceDue: folio?.balanceDue ?? null, currency: folio?.currency ?? null } : null}
        branchId={activeBranchId}
        auth={auth}
        onClose={() => setConfirming(false)}
        onCheckedOut={(name) => {
          setCheckedOutName(name);
          setSelectedId(null);
        }}
      />
    </Container>
  );
}

/** Inside a `tone="secondary"` card, so these keep the secondary family — see design-system/01-color.md. */
function Row({ label, value, emphasis }: { label: string; value: string; emphasis?: 'owed' }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-small text-surface-muted">{label}</span>
      <span className={`text-body font-semibold ${emphasis === 'owed' ? 'text-red-600' : 'text-surface'}`}>{value}</span>
    </div>
  );
}
