'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { AlertsIcon } from '@/components/ui/Icons';
import { useAlertsQuery, type AlertReservation, type MaintenanceAlert, type OverdueCheckout } from '@/lib/alerts';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { useAuthStore } from '@/lib/store/authStore';
import type { FolioListRow } from '@/lib/folios';

type AlertTab = 'missedCheckIns' | 'overdueCheckouts' | 'overdueBalances' | 'maintenance';

/**
 * Alerts (ported from the in-house PMS's own `AlertsService`/Alerts page —
 * see PHASE_NOTES.md for the full comparison). Computed live on every
 * load/60s poll, nothing persisted, no dismiss/ack state: a row disappears
 * the instant the real reservation or folio it's derived from actually
 * changes (the guest gets checked in, checked out, or pays down the
 * balance) — never by a staff member "clearing" the alert itself.
 *
 * No "Unconfirmed Hold" tab — Roomick's `ReservationStatus` has no "pending
 * payment hold" state to port. Maintenance instead: urgent work orders and
 * rooms out of service, until the work order is resolved.
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
    { value: 'maintenance', label: 'Maintenance', count: alerts?.maintenance.length ?? 0 },
  ];

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-6">
      <PageHeader icon={<AlertsIcon className="size-8" />} title="Alerts" subtitle="Missed check-ins, overdue checkouts, overdue balances and urgent maintenance — live" />

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
          balanceOf={(r) => r as OverdueCheckout}
          actionLabel="Check Out"
          actionHref={() => '/dashboard/check-out'}
          footnote="These guests are still in-house, so what they owe shows here rather than under Overdue Balances, which is for guests who have left. Each night they stay, the night audit charges it as an overstay — check them out, or extend the stay from their reservation."
        />
      ) : tab === 'maintenance' ? (
        <MaintenanceTable rows={alerts.maintenance} />
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
  balanceOf,
  actionLabel,
  actionHref,
  footnote,
}: {
  rows: AlertReservation[];
  emptyLabel: string;
  dateLabel: string;
  dateOf: (r: AlertReservation) => string;
  /** Overdue checkouts only: what the guest's bill stands at. */
  balanceOf?: (r: AlertReservation) => OverdueCheckout;
  actionLabel: string;
  actionHref: (r: AlertReservation) => string;
  /** A line under the table, inside the section. */
  footnote?: string;
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
              {balanceOf ? <th className="py-2 pr-4 text-right">Owes</th> : null}
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const bill = balanceOf?.(r);
              const owes = bill ? Number(bill.balanceDue) : 0;
              return (
                <tr key={r.id} className="border-t border-secondary/10 text-small text-secondary">
                  <td className="py-2 pr-4 font-semibold">{r.guest.name}</td>
                  <td className="py-2 pr-4">{r.confirmationNumber}</td>
                  <td className="py-2 pr-4">{r.room ? `${r.room.number} (${r.roomType.name})` : r.roomType.name}</td>
                  <td className="py-2 pr-4">{new Date(dateOf(r)).toLocaleDateString()}</td>
                  {bill ? (
                    <td className={`py-2 pr-4 text-right whitespace-nowrap ${owes > 0 ? 'font-semibold text-red-600' : ''}`}>
                      {bill.folioId ? (
                        <Link href={`/dashboard/billing/${bill.folioId}`} className="underline underline-offset-2">
                          {formatMoney(bill.balanceDue, currencySymbolFor(bill.currency))}
                        </Link>
                      ) : (
                        formatMoney(bill.balanceDue, currencySymbolFor(bill.currency))
                      )}
                    </td>
                  ) : null}
                  <td className="py-2 pr-4 text-right">
                    <Link href={actionHref(r)}>
                      <Button type="button" size="sm">
                        {actionLabel}
                      </Button>
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
      {footnote ? <p className="text-small text-primary-dark/70">{footnote}</p> : null}
    </Section>
  );
}

const PRIORITY_LABEL: Record<MaintenanceAlert['priority'], string> = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' };
const STATUS_LABEL: Record<MaintenanceAlert['status'], string> = { open: 'Open', in_progress: 'In progress', on_hold: 'On hold' };

function MaintenanceTable({ rows }: { rows: MaintenanceAlert[] }) {
  if (rows.length === 0) {
    return (
      <Section label="All Clear">
        <p className="text-body text-primary-dark/70">No urgent work orders, and no room out of service.</p>
      </Section>
    );
  }

  return (
    <Section label={`${rows.length} to resolve`}>
      <Card tone="secondary" className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-small font-bold text-secondary text-left">
              <th className="py-2 pr-4">Work Order</th>
              <th className="py-2 pr-4">Room</th>
              <th className="py-2 pr-4">Priority</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Reported</th>
              <th className="py-2 pr-4" />
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.id} className="border-t border-secondary/10 text-small text-secondary">
                <td className="py-2 pr-4 font-semibold">
                  {w.title}
                  {w.takesRoomOutOfService ? <span className="block text-tiny font-normal text-red-700">Room out of service</span> : null}
                </td>
                <td className="py-2 pr-4">{w.room?.number ?? '—'}</td>
                <td className={`py-2 pr-4 ${w.priority === 'urgent' ? 'font-semibold text-red-700' : ''}`}>{PRIORITY_LABEL[w.priority]}</td>
                <td className="py-2 pr-4">
                  {STATUS_LABEL[w.status]}
                  {w.assignedToUser ? <span className="block text-tiny text-secondary-light">{w.assignedToUser.name}</span> : null}
                </td>
                <td className="py-2 pr-4">{new Date(w.createdAt).toLocaleDateString()}</td>
                <td className="py-2 pr-4 text-right">
                  <Link href="/dashboard/maintenance">
                    <Button type="button" size="sm">
                      Open Maintenance
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
                <td className="py-2 pr-4 font-semibold">{f.guest.name}</td>
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
