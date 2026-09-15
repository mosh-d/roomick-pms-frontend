'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Select, type SelectOption } from '@/components/ui/Select';
import { YesNoToggle } from '@/components/ui/YesNoToggle';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { CancelReservationIcon } from '@/components/ui/Icons';
import {
  useReservationsQuery,
  useCancelReservationMutation,
  useCancelWithWaiverMutation,
  useCancellationQuoteQuery,
  type CancellationQuote,
  type ReservationSummary,
} from '@/lib/reservations';
import { ApiError } from '@/lib/api';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { isSupervisorAtBranch } from '@/lib/roles';
import { useAuthStore } from '@/lib/store/authStore';

const PENALTY_LABELS: Record<CancellationQuote['penaltyType'], string> = {
  first_night: 'first night',
  full_stay: 'full stay',
  flat_fee: 'cancellation fee',
  none: 'none',
};

/**
 * Cancel Reservation (ref p24). The reference's three policy pieces are real
 * now that the branch has a real cancellation policy (`Branch
 * .cancellationPolicy`, the standard default until the owner saves one):
 *
 *  - **Cancellation Policy** — the branch's policy sentence and this
 *    booking's own free-cancellation deadline.
 *  - **Penalty & Refund** — the charge the backend would post right now, its
 *    tax, anything already paid, and the refund or balance that leaves. Every
 *    figure is the backend's quote; nothing is computed here.
 *  - **Manager Override** — Owner/Manager only, through a separate backend
 *    route (hiding the toggle here is UX; the route is the guard). Needs a
 *    reason, which is audited with the manager's id.
 *
 * Confirming sends back the charge that was on screen. If the free window
 * closed in the meantime the backend refuses, and the page re-quotes so what's
 * shown is what would actually be charged.
 */
export default function CancelReservationPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [waive, setWaive] = useState(false);
  const [waiverReason, setWaiverReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelledName, setCancelledName] = useState<string | null>(null);

  const confirmedQuery = useReservationsQuery(activeBranchId, { status: 'confirmed' }, auth);
  const waitlistedQuery = useReservationsQuery(activeBranchId, { status: 'waitlisted' }, auth);
  const quoteQuery = useCancellationQuoteQuery(selectedId, auth);
  const cancelMutation = useCancelReservationMutation(activeBranchId ?? '', auth);
  const waiverMutation = useCancelWithWaiverMutation(activeBranchId ?? '', auth);

  const cancellable: ReservationSummary[] = useMemo(
    () => [...(confirmedQuery.data ?? []), ...(waitlistedQuery.data ?? [])],
    [confirmedQuery.data, waitlistedQuery.data],
  );
  const selected = cancellable.find((r) => r.id === selectedId) ?? null;

  const options: SelectOption[] = useMemo(
    () => cancellable.map((r) => ({ value: r.id, label: `${r.guest.name} — ${r.roomType.name} (${r.confirmationNumber})` })),
    [cancellable],
  );

  if (!activeBranchId) return null;

  const quote = quoteQuery.data;
  const symbol = currencySymbolFor(quote?.currency ?? selected?.branch.currency);
  const hasCharge = quote ? Number(quote.penaltyTotal) > 0 : false;
  const canWaive = isSupervisorAtBranch(user, activeBranchId);
  const waiving = canWaive && waive && hasCharge;
  const pending = cancelMutation.isPending || waiverMutation.isPending;
  const canConfirm = Boolean(selected && quote && !quoteQuery.isFetching && (!waiving || waiverReason.trim().length >= 3));

  function pick(value: string) {
    setSelectedId(value);
    setActionError(null);
    setCancelledName(null);
    setWaive(false);
    setWaiverReason('');
  }

  async function confirmCancel() {
    if (!selected || !quote) return;
    setActionError(null);
    const input = { reservationId: selected.id, reason: reason.trim() || undefined, acknowledgedPenaltyTotal: quote.penaltyTotal };
    try {
      if (waiving) await waiverMutation.mutateAsync({ ...input, waiverReason: waiverReason.trim() });
      else await cancelMutation.mutateAsync(input);
      setCancelledName(selected.guest.name);
      setSelectedId(null);
      setReason('');
      setWaive(false);
      setWaiverReason('');
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
      // The free window closed while the page was open — pull the new terms so what's shown is what would be charged.
      if (error instanceof ApiError && error.code === 'CANCELLATION_TERMS_CHANGED') void quoteQuery.refetch();
    } finally {
      setConfirming(false);
    }
  }

  const consequence = !quote
    ? ''
    : waiving
      ? `The ${formatMoney(quote.penaltyTotal, symbol)} cancellation charge is waived — nothing will be charged.`
      : hasCharge
        ? `A cancellation charge of ${formatMoney(quote.penaltyTotal, symbol)} will be posted to their folio.`
        : 'No cancellation charge applies.';

  return (
    <Container className="max-w-3xl py-10 flex flex-col gap-6">
      <PageHeader icon={<CancelReservationIcon className="size-8" />} title="Cancel Reservation" subtitle="Handle cancellations" />

      {cancelledName ? <p className="text-body font-semibold text-primary-dark">{cancelledName}&apos;s reservation is cancelled.</p> : null}

      <Section label="Reservation Search">
        {confirmedQuery.isLoading || waitlistedQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading reservations…</p>
        ) : options.length === 0 ? (
          <p className="text-body text-primary-dark/70">No confirmed or waitlisted reservations to cancel.</p>
        ) : (
          <>
            <Select id="cancel-reservation" name="reservationId" label="Reservation" options={options} value={selectedId} onChange={pick} />

            {selected ? (
              <Card tone="secondary" className="flex flex-col gap-2">
                <Row label="Name" value={selected.guest.name} />
                <Row label="Room Type" value={selected.roomType.name} />
                <Row label="Check-In Date" value={new Date(selected.checkInDate).toLocaleDateString()} />
                <Row label="Check-Out Date" value={new Date(selected.checkOutDate).toLocaleDateString()} />
                <Row label="Status" value={selected.status === 'waitlisted' ? 'Waitlisted' : 'Confirmed'} />
              </Card>
            ) : null}
          </>
        )}
      </Section>

      {selected ? (
        <Section label="Cancellation Policy">
          {quoteQuery.isLoading ? (
            <p className="text-body text-primary-dark/70">Checking the cancellation policy…</p>
          ) : quoteQuery.isError || !quote ? (
            <p className="text-small text-red-600">Couldn&apos;t load the cancellation terms for this reservation.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
              <Card tone="accent" className="flex flex-col gap-2">
                <p className="text-small text-primary-dark">{quote.policy.summary}</p>
                <p className={`text-small font-semibold ${quote.withinFreeWindow ? 'text-green-700' : 'text-red-600'}`}>
                  {quote.withinFreeWindow
                    ? `Free to cancel until ${new Date(quote.freeCancellationUntil).toLocaleString()}.`
                    : `The free cancellation window closed ${new Date(quote.freeCancellationUntil).toLocaleString()}.`}
                </p>
                {!quote.policy.allowOnlineCancellation ? (
                  <p className="text-tiny text-primary-dark/70">Guests can&apos;t cancel online at this property — cancellations come through the desk.</p>
                ) : null}
              </Card>

              <Card tone="secondary" className="flex flex-col gap-2">
                <h3 className="text-body font-bold text-secondary">Penalty &amp; Refund</h3>
                <Row label={`Charge (${PENALTY_LABELS[quote.penaltyType]})`} value={formatMoney(quote.penaltyAmount, symbol)} />
                <Row label="Tax" value={formatMoney(quote.penaltyTax, symbol)} />
                <Row label="Total charge" value={waiving ? 'Waived' : formatMoney(quote.penaltyTotal, symbol)} />
                <Row label="Paid so far" value={formatMoney(quote.paidSoFar, symbol)} />
                {waiving ? (
                  Number(quote.paidSoFar) > 0 ? <Row label="Refund due" value={formatMoney(quote.paidSoFar, symbol)} /> : null
                ) : Number(quote.refundDue) > 0 ? (
                  <Row label="Refund due" value={formatMoney(quote.refundDue, symbol)} />
                ) : (
                  <Row label="Guest will owe" value={formatMoney(quote.amountOwed, symbol)} />
                )}
                {Number(quote.refundDue) > 0 || (waiving && Number(quote.paidSoFar) > 0) ? (
                  <p className="text-tiny text-secondary-light">Refunds aren&apos;t issued automatically — record it from the guest&apos;s folio.</p>
                ) : null}
              </Card>
            </div>
          )}
        </Section>
      ) : null}

      {selected && quote ? (
        <Section label="Confirm">
          {canWaive && hasCharge ? (
            <div className="flex flex-col gap-2">
              <YesNoToggle
                label="Manager override: waive the cancellation charge"
                name="waive-cancellation-charge"
                value={waive ? 'yes' : 'no'}
                onChange={(v) => setWaive(v === 'yes')}
              />
              {waive ? (
                <Textarea
                  id="waiver-reason"
                  label="Reason for Waiver"
                  value={waiverReason}
                  onChange={(e) => setWaiverReason(e.target.value)}
                  hint="Required — recorded in the audit log with your name"
                />
              ) : null}
            </div>
          ) : null}

          <Textarea
            id="cancel-reason"
            label="Reason for Cancellation"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            hint="Optional — recorded on the reservation for audit"
          />

          {actionError ? <p className="text-small text-red-600">{actionError}</p> : null}

          <Button type="button" variant="danger" disabled={!canConfirm} loading={pending} onClick={() => setConfirming(true)} className="self-start">
            Confirm Cancellation
          </Button>
        </Section>
      ) : null}

      <ConfirmDialog
        open={confirming}
        title="Cancel this reservation?"
        description={`This cancels ${selected?.guest.name ?? 'this guest'}'s reservation${
          selected?.status === 'waitlisted' ? ' and removes them from the waitlist' : ''
        }. ${consequence} This cannot be undone.`}
        confirmLabel="Confirm Cancellation"
        onCancel={() => setConfirming(false)}
        onConfirm={confirmCancel}
      />
    </Container>
  );
}

/** Inside a `tone="secondary"` card, so these keep the secondary family — see design-system/01-color.md. */
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-small text-secondary-light">{label}</span>
      <span className="text-body font-semibold text-secondary">{value}</span>
    </div>
  );
}
