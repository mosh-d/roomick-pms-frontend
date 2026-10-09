'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { ApiError } from '@/lib/api';
import { currencySymbolFor } from '@/lib/currencies';
import { formatMoney } from '@/lib/numberFormat';
import { useCheckOutMutation, useCheckOutQuoteQuery } from '@/lib/reservations';
import { isSupervisorAtBranch } from '@/lib/roles';
import { useAuthStore } from '@/lib/store/authStore';

export interface CheckOutTarget {
  id: string;
  guestName: string;
  balanceDue: string | null;
  currency: string | null;
}

/**
 * Confirms a check-out, saying first what it adds to the bill: the late
 * check-out or early departure fee the branch charges — which a manager can
 * waive, saying why — and what the guest will still owe. Never blocked by a
 * balance: it becomes a City Ledger receivable.
 */
export function CheckOutDialog({
  target,
  branchId,
  auth,
  onClose,
  onCheckedOut,
}: {
  target: CheckOutTarget | null;
  branchId: string;
  auth: { accessToken: string | undefined; tenantId: string | undefined };
  onClose: () => void;
  onCheckedOut?: (guestName: string) => void;
}) {
  const user = useAuthStore((s) => s.user);
  const quoteQuery = useCheckOutQuoteQuery(target?.id ?? null, auth);
  const checkOutMutation = useCheckOutMutation(branchId, auth);
  const [waive, setWaive] = useState(false);
  const [waiverReason, setWaiverReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fees = quoteQuery.data?.fees ?? [];
  const symbol = currencySymbolFor(quoteQuery.data?.currency ?? target?.currency ?? undefined);
  const feesTotal = fees.reduce((sum, fee) => sum + Number(fee.total), 0);
  const owedBefore = Number(target?.balanceDue ?? 0);
  const owedAfter = owedBefore + (waive ? 0 : feesTotal);
  const supervisor = isSupervisorAtBranch(user, branchId);

  function close() {
    if (checkOutMutation.isPending) return;
    setWaive(false);
    setWaiverReason('');
    setError(null);
    onClose();
  }

  async function confirm() {
    if (!target) return;
    setError(null);
    try {
      await checkOutMutation.mutateAsync(waive ? { reservationId: target.id, waiveFees: true, waiverReason: waiverReason.trim() } : target.id);
      onCheckedOut?.(target.guestName);
      setWaive(false);
      setWaiverReason('');
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Modal open={target !== null} onClose={close} title="Check out this guest?">
      <p className="text-body text-surface-muted">This checks out {target?.guestName ?? 'this guest'} and releases the room for cleaning.</p>

      {quoteQuery.isLoading ? <p className="text-small text-surface-muted">Checking the check-out fees…</p> : null}
      {fees.length > 0 ? (
        <div className="flex flex-col gap-2 rounded-control border border-primary/30 p-3">
          <p className="text-small font-semibold text-surface">Checking out now adds:</p>
          {fees.map((fee) => (
            <div key={fee.kind} className="flex items-center justify-between gap-4">
              <span className={`text-small ${waive ? 'text-surface-muted line-through' : 'text-surface'}`}>{fee.description}</span>
              <span className={`text-small font-semibold ${waive ? 'text-surface-muted line-through' : 'text-surface'}`}>
                {formatMoney(fee.total, symbol)}
                {Number(fee.tax) > 0 ? <span className="text-tiny font-normal text-surface-muted"> incl. {formatMoney(fee.tax, symbol)} tax</span> : null}
              </span>
            </div>
          ))}
          {supervisor ? (
            <>
              <label className="flex items-center gap-2 text-small text-surface cursor-pointer">
                <input type="checkbox" checked={waive} onChange={(e) => setWaive(e.target.checked)} className="size-4 accent-secondary" />
                Waive {fees.length === 1 ? 'this fee' : 'these fees'}
              </label>
              {waive ? (
                <Textarea id="checkout-waiver-reason" label="Why" value={waiverReason} onChange={(e) => setWaiverReason(e.target.value)} maxLength={300} hint="Recorded in the audit trail with your name" />
              ) : null}
            </>
          ) : (
            <p className="text-tiny text-surface-muted">Only a manager can waive {fees.length === 1 ? 'it' : 'them'}.</p>
          )}
        </div>
      ) : null}

      <p className="text-body text-surface-muted">
        {owedAfter > 0
          ? `They will still owe ${formatMoney(owedAfter, symbol)} — the balance becomes a City Ledger receivable.`
          : 'The bill is fully paid and will be settled automatically.'}
      </p>

      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={close} disabled={checkOutMutation.isPending}>
          Cancel
        </Button>
        <Button type="button" variant="danger" onClick={confirm} loading={checkOutMutation.isPending} disabled={waive && waiverReason.trim().length < 3}>
          Check-Out
        </Button>
      </div>
    </Modal>
  );
}
