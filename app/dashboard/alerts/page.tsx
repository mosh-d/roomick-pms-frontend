'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { AlertsIcon } from '@/components/ui/Icons';
import { useAlertsQuery, type AlertReservation } from '@/lib/alerts';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { useAuthStore } from '@/lib/store/authStore';
import type { FolioListRow } from '@/lib/folios';

type AlertTab = 'missedCheckIns' | 'overdueCheckouts' | 'overdueBalances';

/**
 * Alerts (ported from the in-house PMS's own `AlertsService`/Alerts page —
 * see PHASE_NOTES.md for the full comparison). Computed live on every
 * load/60s poll, nothing persisted, no dismiss/ack state: a row disappears
 * the instant the real reservation or folio it's derived from actually
 * changes (the guest gets checked in, checked out, or pays down the
 * balance) — never by a staff member "clearing" the alert itself.
 *
 * Only three tabs, not the reference's four — Roomick's `ReservationStatus`
 * has no "pending payment hold" state, so there's no real equivalent of the
 * reference's fourth "Unconfirmed Hold" category to port.
 */
export default function AlertsPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [tab, setTab] = useState<AlertTab>('overdueCheckouts');
  const alertsQuery = useAlertsQuery(activeBranchId, auth);

  if (!activeBranchId) return null;

  const alerts = alertsQuery.data;
  const tabs: Array<{ value: AlertTab; label: string; count: number }> = [
    { value: 'missedCheckIns', label: 'Missed Check-Ins', count: alerts?.missedCheckIns.length ?? 0 },
    { value: 'overdueCheckouts', label: 'Overdue Checkouts', count: alerts?.overdueCheckouts.length ?? 0 },
    { value: 'overdueBalances', label: 'Overdue Balances', count: alerts?.overdueBalances.length ?? 0 },
  ];

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-6">
      <PageHeader icon={<AlertsIcon className="size-8" />} title="Alerts" subtitle="Missed check-ins, overdue checkouts, and overdue balances — live" />

      <div className="inline-flex flex-wrap rounded-control border border-accent/30 p-1 gap-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`inline-flex items-center gap-2 rounded-control px-3 py-1.5 text-small font-semibold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              tab === t.value ? 'bg-primary text-white' : 'text-primary-dark hover:bg-accent/10'
            }`}
          >
            {t.label}
            {t.count > 0 ? (
              <span
                className={`inline-flex min-w-5 items-center justify-center rounded-pill px-1.5 py-0.5 text-tiny font-bold leading-none ${
                  tab === t.value ? 'bg-white/25 text-white' : 'bg-red-600 text-white'
                }`}
              >
                {t.count}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {alertsQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading…</p>
      ) : alertsQuery.isError || !alerts ? (
        <p className="text-body text-red-600">Could not load alerts.</p>
      ) : tab === 'missedCheckIns' ? (
        <ReservationAlertsTable
          rows={alerts.missedCheckIns}
          emptyLabel="No missed check-ins — every confirmed reservation due so far has arrived."
          dateLabel="Expected Check-In"
          dateOf={(r) => r.checkInDate}
          actionLabel="Check In"
          actionHref={(r) => `/dashboard/check-in/${r.id}`}
        />
      ) : tab === 'overdueCheckouts' ? (
        <ReservationAlertsTable
          rows={alerts.overdueCheckouts}
          emptyLabel="No overdue checkouts — every checked-in guest is within their scheduled stay."
          dateLabel="Scheduled Check-Out"
          dateOf={(r) => r.checkOutDate}
          actionLabel="Check Out"
          actionHref={() => '/dashboard/check-out'}
        />
      ) : (
        <OverdueBalancesTable rows={alerts.overdueBalances} />
      )}
    </Container>
  );
}

function ReservationAlertsTable({
  rows,
  emptyLabel,
  dateLabel,
  dateOf,
  actionLabel,
  actionHref,
}: {
  rows: AlertReservation[];
  emptyLabel: string;
  dateLabel: string;
  dateOf: (r: AlertReservation) => string;
  actionLabel: string;
  actionHref: (r: AlertReservation) => string;
}) {
  if (rows.length === 0) {
    return (
      <Section label="All Clear">
        <p className="text-body text-primary-dark/70">{emptyLabel}</p>
      </Section>
    );
  }

  return (
    <Section label={`${rows.length} to resolve`}>
      <Card tone="secondary" className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-small font-bold text-secondary text-left">
              <th className="py-2 pr-4">Guest</th>
              <th className="py-2 pr-4">Confirmation #</th>
              <th className="py-2 pr-4">Room</th>
              <th className="py-2 pr-4">{dateLabel}</th>
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-secondary/10 text-small text-secondary">
                <td className="py-2 pr-4 font-semibold text-primary-dark">{r.guest.name}</td>
                <td className="py-2 pr-4">{r.confirmationNumber}</td>
                <td className="py-2 pr-4">{r.room ? `${r.room.number} (${r.roomType.name})` : r.roomType.name}</td>
                <td className="py-2 pr-4">{new Date(dateOf(r)).toLocaleDateString()}</td>
                <td className="py-2 pr-4 text-right">
                  <Link href={actionHref(r)}>
                    <Button type="button" size="sm">
                      {actionLabel}
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Section>
  );
}

function OverdueBalancesTable({ rows }: { rows: FolioListRow[] }) {
  if (rows.length === 0) {
    return (
      <Section label="All Clear">
        <p className="text-body text-primary-dark/70">No overdue balances — every departed guest&apos;s folio is fully settled.</p>
      </Section>
    );
  }

  return (
    <Section label={`${rows.length} to resolve`}>
      <Card tone="secondary" className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-small font-bold text-secondary text-left">
              <th className="py-2 pr-4">Guest</th>
              <th className="py-2 pr-4">Confirmation #</th>
              <th className="py-2 pr-4">Checked Out</th>
              <th className="py-2 pr-4 text-right">Balance Owed</th>
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {rows.map((f) => (
              <tr key={f.id} className="border-t border-secondary/10 text-small text-secondary">
                <td className="py-2 pr-4 font-semibold text-primary-dark">{f.guest.name}</td>
                <td className="py-2 pr-4">{f.reservation?.confirmationNumber ?? 'NIL'}</td>
                <td className="py-2 pr-4">{f.reservation ? new Date(f.reservation.checkOutDate).toLocaleDateString() : 'NIL'}</td>
                <td className="py-2 pr-4 text-right font-semibold text-red-600">{formatMoney(f.balanceDue, currencySymbolFor(f.currency))}</td>
                <td className="py-2 pr-4 text-right">
                  <Link href={`/dashboard/billing/${f.id}`}>
                    <Button type="button" size="sm">
                      View Folio
                    </Button>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </Section>
  );
}
