'use client';

import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { NoShowIcon } from '@/components/ui/Icons';
import {
  usePendingNoShowsQuery,
  useMarkNoShowMutation,
  useWaiveNoShowPenaltyMutation,
  useReinstateFromNoShowMutation,
  useReservationsQuery,
  type ReservationSummary,
} from '@/lib/reservations';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

function todayString(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

/**
 * No-Show Handling (ref p9's sidebar, under Billing and Payments) — front
 * desk's own live view of who hasn't shown up, reachable any time during
 * the day (the same underlying condition `NightAuditService`'s own
 * preflight checklist already surfaces, just not as a dashboard someone
 * can act from directly). Marking, waiving, and reinstating all share the
 * exact backend paths the automated midnight sweep uses (`Reservations
 * Service.markNoShowInTx`), so a manually-marked no-show and an
 * automatically-marked one get identical penalty treatment.
 */
export default function NoShowHandlingPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [formError, setFormError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [reinstating, setReinstating] = useState<ReservationSummary | null>(null);
  const [reinstateCheckIn, setReinstateCheckIn] = useState('');
  const [reinstateCheckOut, setReinstateCheckOut] = useState('');
  const [reinstateWaive, setReinstateWaive] = useState(false);

  const pendingQuery = usePendingNoShowsQuery(activeBranchId, auth);
  const recentQuery = useReservationsQuery(activeBranchId, { status: 'no_show' }, auth);
  const markMutation = useMarkNoShowMutation(activeBranchId ?? '', auth);
  const waiveMutation = useWaiveNoShowPenaltyMutation(activeBranchId ?? '', auth);
  const reinstateMutation = useReinstateFromNoShowMutation(activeBranchId ?? '', auth);

  if (!activeBranchId) return null;

  async function confirmMark() {
    if (!markingId) return;
    setFormError(null);
    try {
      await markMutation.mutateAsync(markingId);
      setMarkingId(null);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
      setMarkingId(null);
    }
  }

  async function waive(noShowRecordId: string) {
    setFormError(null);
    try {
      await waiveMutation.mutateAsync(noShowRecordId);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  function openReinstate(reservation: ReservationSummary) {
    const today = todayString();
    setReinstating(reservation);
    setReinstateCheckIn(today);
    setReinstateCheckOut('');
    setReinstateWaive(false);
    setFormError(null);
  }

  async function confirmReinstate() {
    if (!reinstating || !reinstateCheckIn || !reinstateCheckOut) return;
    setFormError(null);
    try {
      await reinstateMutation.mutateAsync({
        reservationId: reinstating.id,
        checkInDate: reinstateCheckIn,
        checkOutDate: reinstateCheckOut,
        waivePenalty: reinstateWaive || undefined,
      });
      setReinstating(null);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  const pendingList = pendingQuery.data ?? [];
  const recentList = recentQuery.data ?? [];

  return (
    <Container className="max-w-4xl py-10 flex flex-col gap-8">
      <PageHeader
        icon={<NoShowIcon className="size-8" />}
        title="No-Show Handling"
        subtitle="Deliberate operational flow for guests who never arrive. Applies policy penalties, releases inventory, and closes or voids the folio correctly."
        roles="Front Desk · Manager"
      />

      {formError ? <p className="text-small text-red-600">{formError}</p> : null}

      <Section label="Pending No-Shows">
        {pendingQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading…</p>
        ) : pendingList.length === 0 ? (
          <p className="text-body text-primary-dark/70">Nothing pending — every confirmed arrival has either checked in or already been marked.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {pendingList.map((r) => (
              <Card key={r.id} tone="secondary" className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-body font-semibold text-secondary">
                    {r.guest.name} — {r.roomType.name}
                  </p>
                  <p className="text-small text-secondary-light">
                    {r.confirmationNumber} · Check-in was {new Date(r.checkInDate).toLocaleDateString()}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setMarkingId(r.id)}>
                  Mark as No-Show
                </Button>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section label="Recent No-Shows">
        {recentQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading…</p>
        ) : recentList.length === 0 ? (
          <p className="text-body text-primary-dark/70">No no-shows recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {recentList.map((r) => {
              const record = r.noShowRecords[0];
              const symbol = currencySymbolFor(r.branch.currency);
              const hasUnwaivedPenalty = record && !record.penaltyWaived && record.penaltyAmount !== null;
              return (
                <Card key={r.id} tone="secondary" className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-body font-semibold text-secondary">
                        {r.guest.name} — {r.roomType.name}
                      </p>
                      <p className="text-small text-secondary-light">
                        {r.confirmationNumber} · Was due {new Date(r.checkInDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasUnwaivedPenalty ? (
                        <Button size="sm" variant="outline" loading={waiveMutation.isPending} onClick={() => waive(record.id)}>
                          Waive Penalty
                        </Button>
                      ) : null}
                      <Button size="sm" variant="outline" onClick={() => openReinstate(r)}>
                        Reinstate
                      </Button>
                    </div>
                  </div>
                  {record ? (
                    <p className="text-small text-secondary-light">
                      Penalty ({record.penaltyType.replace('_', ' ')}):{' '}
                      {record.penaltyAmount === null ? 'None' : formatMoney(record.penaltyAmount, symbol)}
                      {record.penaltyWaived ? ' — Waived' : ''}
                    </p>
                  ) : null}
                </Card>
              );
            })}
          </div>
        )}
      </Section>

      <ConfirmDialog
        open={markingId !== null}
        title="Mark as no-show?"
        description="This applies the branch's no-show penalty (if any) and releases the reservation's hold on inventory. The room itself was never held physically, so nothing else changes."
        confirmLabel="Mark as No-Show"
        onCancel={() => setMarkingId(null)}
        onConfirm={confirmMark}
      />

      <Modal open={reinstating !== null} onClose={() => setReinstating(null)} title="Reinstate reservation">
        {reinstating ? (
          <div className="flex flex-col gap-4">
            <p className="text-body text-secondary-light">
              {reinstating.guest.name} — {reinstating.roomType.name}. The original dates have passed; pick new ones for this late arrival.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <Input
                name="reinstateCheckIn"
                label="Check-In Date"
                type="date"
                min={todayString()}
                value={reinstateCheckIn}
                onChange={(e) => setReinstateCheckIn(e.target.value)}
              />
              <Input
                name="reinstateCheckOut"
                label="Check-Out Date"
                type="date"
                min={reinstateCheckIn || todayString()}
                value={reinstateCheckOut}
                onChange={(e) => setReinstateCheckOut(e.target.value)}
              />
            </div>
            {reinstating.noShowRecords[0] && !reinstating.noShowRecords[0].penaltyWaived && reinstating.noShowRecords[0].penaltyAmount !== null ? (
              <label className="flex items-center gap-2 text-small text-secondary">
                <input type="checkbox" checked={reinstateWaive} onChange={(e) => setReinstateWaive(e.target.checked)} />
                Also waive the no-show penalty
              </label>
            ) : null}
            <Button
              type="button"
              disabled={!reinstateCheckIn || !reinstateCheckOut}
              loading={reinstateMutation.isPending}
              onClick={confirmReinstate}
              className="self-start"
            >
              Reinstate
            </Button>
          </div>
        ) : null}
      </Modal>
    </Container>
  );
}
