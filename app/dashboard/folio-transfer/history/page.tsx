'use client';

import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { TransferHistoryIcon } from '@/components/ui/Icons';
import { ApiError } from '@/lib/api';
import { TRANSFER_REVERSAL_WINDOW_MS, useBranchTransfersQuery, useReverseTransferMutation, type FolioTransfer, type TransferEnd } from '@/lib/folios';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { isSupervisorAtBranch } from '@/lib/roles';
import { useAuthStore } from '@/lib/store/authStore';

function endName(end: TransferEnd | undefined): string {
  if (!end) return '—';
  const room = end.reservation.room ? ` — Room ${end.reservation.room.number}` : '';
  return `${end.guest.name}${room}${end.label ? ` (${end.label})` : ''}`;
}

/**
 * Transfer History (ref: "Full audit trail of all folio movements") — every
 * charge move at the property, newest first: from which bill to which, how
 * much, why, who moved it and when. A manager can put a move back for a day
 * (ref: "Reverse transfer button (manager, 24h window)") while its charges
 * are still where it left them; after that it's a new transfer.
 */
export default function TransferHistoryPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [reversing, setReversing] = useState<FolioTransfer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Read once, on first render — the 24-hour window is judged against the time the page opened, not re-checked every render.
  const [openedAt] = useState(() => Date.now());

  const transfersQuery = useBranchTransfersQuery(activeBranchId, { from: from || undefined, to: to || undefined }, auth);
  const reverseMutation = useReverseTransferMutation(activeBranchId ?? '', auth);

  if (!activeBranchId) return null;
  const canReverse = isSupervisorAtBranch(user, activeBranchId);
  const transfers = transfersQuery.data ?? [];
  const symbol = currencySymbolFor(transfers[0]?.currency);

  async function confirmReverse() {
    if (!reversing) return;
    const transfer = reversing;
    setReversing(null);
    setError(null);
    setNotice(null);
    try {
      await reverseMutation.mutateAsync(transfer);
      setNotice(`Put back: ${formatMoney(transfer.amount, symbol)} returned to ${endName(transfer.sourceFolio)}.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not reverse the transfer.');
    }
  }

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader icon={<TransferHistoryIcon className="size-8" />} title="Transfer History" subtitle="Every charge moved between bills, and who moved it." roles="Front Desk · Manager · Accountant" />

      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {notice ? (
        <Card tone="secondary">
          <p className="text-small text-secondary">{notice}</p>
        </Card>
      ) : null}

      <Section label="Moves">
        <div className="flex flex-wrap gap-4">
          <div className="w-44">
            <Input label="From" name="from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="w-44">
            <Input label="To" name="to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>

        {transfersQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading…</p>
        ) : transfers.length === 0 ? (
          <p className="text-body text-primary-dark/70">No charges have been moved between bills{from || to ? ' in these dates' : ''}.</p>
        ) : (
          <ol className="flex flex-col gap-3" aria-label="Transfers, newest first">
            {transfers.map((t) => {
              const withinWindow = openedAt - new Date(t.createdAt).getTime() <= TRANSFER_REVERSAL_WINDOW_MS;
              const sameStay = t.sourceFolio?.reservationId === t.targetFolio?.reservationId;
              return (
                <li key={t.id}>
                  <Card tone="secondary" className="flex flex-col gap-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex flex-col gap-1">
                        <p className="text-small font-bold text-secondary">
                          {endName(t.sourceFolio)} → {endName(t.targetFolio)}
                        </p>
                        <p className="text-tiny text-secondary-light">
                          {new Date(t.createdAt).toLocaleString()} · {t.approvedByUser?.name ?? 'Unknown'} · {t.lineItemIds.length} line{t.lineItemIds.length === 1 ? '' : 's'}
                          {sameStay ? ' · within one stay' : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-body font-semibold text-secondary">{formatMoney(t.amount, symbol)}</span>
                        {t.reversedAt ? (
                          <span className="inline-flex rounded-pill bg-primary/15 px-2 py-0.5 text-tiny font-semibold text-primary-dark">
                            Reversed{t.reversedByUser ? ` by ${t.reversedByUser.name}` : ''}
                          </span>
                        ) : canReverse && withinWindow ? (
                          <Button type="button" size="sm" variant="outline" onClick={() => setReversing(t)}>
                            Reverse
                          </Button>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-small text-secondary">Reason: {t.reason}</p>
                  </Card>
                </li>
              );
            })}
          </ol>
        )}
      </Section>

      <ConfirmDialog
        open={reversing !== null}
        title="Reverse this transfer?"
        description={
          reversing
            ? `${formatMoney(reversing.amount, symbol)} goes back from ${endName(reversing.targetFolio)} to ${endName(reversing.sourceFolio)}.`
            : ''
        }
        confirmLabel="Reverse"
        onConfirm={confirmReverse}
        onCancel={() => setReversing(null)}
      />
    </Container>
  );
}
