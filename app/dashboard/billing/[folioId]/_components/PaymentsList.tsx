'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { ApiError } from '@/lib/api';
import { formatMoment } from '@/lib/dates';
import { describeForeign, useVoidPaymentMutation, type FolioPayment } from '@/lib/folios';
import { formatMoney } from '@/lib/numberFormat';

const METHOD_LABELS: Record<string, string> = {
  cash: 'Cash',
  card: 'Card',
  bank_transfer: 'Bank transfer',
  voucher: 'Voucher',
  loyalty_points: 'Loyalty points',
};

/**
 * Every payment on the bill, voided ones included (struck through, with who
 * voided it and why). A supervisor can void one recorded in error — the
 * wrong bill, a card that was declined after all; money actually handed back
 * to a guest is a refund instead.
 */
export function PaymentsList({
  payments,
  branchId,
  folioId,
  symbol,
  canVoid,
  auth,
}: {
  payments: FolioPayment[];
  branchId: string;
  folioId: string;
  symbol: string;
  canVoid: boolean;
  auth: { accessToken: string | undefined; tenantId: string | undefined };
}) {
  const voidMutation = useVoidPaymentMutation(branchId, folioId, auth);
  const [voiding, setVoiding] = useState<FolioPayment | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function confirmVoid() {
    if (!voiding) return;
    setError(null);
    try {
      await voidMutation.mutateAsync({ paymentId: voiding.id, reason: reason.trim() });
      setVoiding(null);
      setReason('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  if (payments.length === 0) return <p className="text-body text-surface-muted">No payments on this bill yet.</p>;

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-primary/25">
              <th className="text-small font-bold text-surface pb-2 pr-4">Taken</th>
              <th className="text-small font-bold text-surface pb-2 pr-4">How</th>
              <th className="text-small font-bold text-surface pb-2 pr-4">Reference</th>
              <th className="text-small font-bold text-surface pb-2 pr-4 text-right">Amount</th>
              {canVoid ? <th className="pb-2" /> : null}
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => {
              const refund = Number(payment.amount) < 0;
              const foreign = describeForeign(payment);
              return (
                <tr key={payment.id} className="border-b border-primary/15 last:border-0 align-top">
                  <td className="text-small text-surface py-3 pr-4 whitespace-nowrap">
                    {formatMoment(payment.recordedAt, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {payment.recordedByUser ? <span className="block text-tiny text-surface-muted">{payment.recordedByUser.name}</span> : null}
                  </td>
                  <td className="text-small text-surface py-3 pr-4">
                    {refund ? 'Refund' : (METHOD_LABELS[payment.method] ?? payment.method)}
                    {payment.paymentPurpose === 'deposit' ? <span className="ml-2 inline-flex rounded-pill bg-primary/15 px-2 py-0.5 text-tiny font-semibold text-primary-dark">Deposit</span> : null}
                    {foreign ? <span className="block text-tiny text-surface-muted">{foreign}</span> : null}
                  </td>
                  <td className="text-small text-surface-muted py-3 pr-4">{payment.reference ?? '—'}</td>
                  <td className="text-small py-3 pr-4 text-right whitespace-nowrap">
                    <span className={payment.isVoid ? 'line-through text-surface-muted' : refund ? 'text-red-600 font-semibold' : 'text-surface font-semibold'}>
                      {formatMoney(payment.amount, symbol)}
                    </span>
                    {payment.isVoid ? (
                      <span className="block text-tiny text-surface-muted whitespace-normal">
                        Voided{payment.voidedByUser ? ` by ${payment.voidedByUser.name}` : ''}: {payment.voidReason}
                      </span>
                    ) : null}
                  </td>
                  {canVoid ? (
                    <td className="py-3 text-right">
                      {!payment.isVoid && !refund ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => setVoiding(payment)}>
                          Void
                        </Button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={voiding !== null} onClose={() => (voidMutation.isPending ? undefined : setVoiding(null))} title="Void this payment?">
        <p className="text-small text-surface-muted">
          {voiding ? `${formatMoney(voiding.amount, symbol)} by ${METHOD_LABELS[voiding.method] ?? voiding.method}` : ''} stays on record, marked void with your name and the reason, and the bill
          owes it again. For money actually handed back to the guest, record a refund instead.
          {voiding?.method === 'loyalty_points' ? ' The points go back to the guest.' : ''}
        </p>
        <Textarea id="void-reason" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} hint="Required — recorded in the audit trail" />
        {error ? <p className="text-small text-red-600">{error}</p> : null}
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={() => setVoiding(null)} disabled={voidMutation.isPending}>
            Keep It
          </Button>
          <Button type="button" variant="danger" onClick={confirmVoid} loading={voidMutation.isPending} disabled={reason.trim().length < 3}>
            Void Payment
          </Button>
        </div>
      </Modal>
    </>
  );
}
