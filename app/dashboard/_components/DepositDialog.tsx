'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { ApiError } from '@/lib/api';
import { currencySymbolFor } from '@/lib/currencies';
import { formatDateOnly, hotelToday } from '@/lib/dates';
import { useExchangeRatesQuery, useRecordDepositMutation, type PaymentMethod } from '@/lib/folios';
import { formatMoney } from '@/lib/numberFormat';
import { PAYMENT_METHOD_OPTIONS } from '@/lib/schemas/folios';
import type { ReservationSummary } from '@/lib/reservations';

type DepositFields = Pick<ReservationSummary, 'depositAmount' | 'depositDueDate' | 'depositPaid'> & { branch: { currency: string } };

/** Where a booking's deposit stands: nothing asked, paid, still due, or overdue. */
export function depositState(r: DepositFields): { label: string; tone: 'muted' | 'ok' | 'due' | 'late' } {
  const asked = Number(r.depositAmount ?? 0);
  const paid = Number(r.depositPaid ?? 0);
  const symbol = currencySymbolFor(r.branch.currency);
  if (asked <= 0) return paid > 0 ? { label: `${formatMoney(paid, symbol)} paid`, tone: 'ok' } : { label: 'None asked', tone: 'muted' };
  if (paid >= asked) return { label: `${formatMoney(paid, symbol)} paid`, tone: 'ok' };
  const due = r.depositDueDate ? r.depositDueDate.slice(0, 10) : null;
  const late = due !== null && due < hotelToday();
  const owing = formatMoney(asked - paid, symbol);
  return { label: `${owing} ${late ? 'overdue' : `due${due ? ` ${formatDateOnly(due)}` : ''}`}`, tone: late ? 'late' : 'due' };
}

export function DepositStatus({ reservation }: { reservation: DepositFields }) {
  const state = depositState(reservation);
  const tone = { muted: 'text-surface-muted', ok: 'text-green-700 font-semibold', due: 'text-surface-accent font-semibold', late: 'text-red-600 font-semibold' }[state.tone];
  return <span className={tone}>{state.label}</span>;
}

/**
 * Takes a deposit before the guest arrives. It goes on the stay's own bill
 * (opened for it, waiting for check-in) and counts towards the stay; a
 * cancellation charge comes out of it, and the rest is refundable.
 */
export function DepositDialog({
  reservation,
  branchId,
  auth,
  onClose,
}: {
  reservation: (ReservationSummary & DepositFields) | null;
  branchId: string;
  auth: { accessToken: string | undefined; tenantId: string | undefined };
  onClose: () => void;
}) {
  const mutation = useRecordDepositMutation(branchId, reservation?.id ?? '', auth);
  const ratesQuery = useExchangeRatesQuery(reservation ? branchId : null, auth);
  const owing = Math.max(0, Number(reservation?.depositAmount ?? 0) - Number(reservation?.depositPaid ?? 0));
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<string | null>('bank_transfer');
  const [currency, setCurrency] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const base = ratesQuery.data?.baseCurrency ?? reservation?.branch.currency ?? '';
  const symbol = currencySymbolFor(base);
  const rate = ratesQuery.data?.rates.find((r) => r.currency === currency);

  function close() {
    if (mutation.isPending) return;
    setAmount('');
    setReference('');
    setError(null);
    onClose();
  }

  async function save() {
    if (!reservation) return;
    setError(null);
    try {
      await mutation.mutateAsync({
        amount: Number(amount),
        method: (method ?? 'bank_transfer') as PaymentMethod,
        reference: reference.trim() || undefined,
        currency: rate ? rate.currency : undefined,
      });
      close();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Modal open={reservation !== null} onClose={close} title="Take a deposit">
      {reservation ? (
        <p className="text-small text-surface-muted">
          {reservation.guest.name} · {reservation.confirmationNumber}.{' '}
          {Number(reservation.depositAmount ?? 0) > 0
            ? `Asked: ${formatMoney(reservation.depositAmount ?? 0, symbol)}${reservation.depositDueDate ? `, due ${formatDateOnly(reservation.depositDueDate)}` : ''}; paid so far ${formatMoney(reservation.depositPaid ?? 0, symbol)}.`
            : 'No deposit was asked for this booking — you can still take one.'}
        </p>
      ) : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
        <Input
          id="deposit-amount"
          label={rate ? `Amount (${rate.currency})` : 'Amount'}
          type="number"
          min={0}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          hint={rate && Number(amount) > 0 ? `${formatMoney(Math.round(Number(amount) * Number(rate.rate) * 100) / 100, symbol)} at ${rate.rate}` : undefined}
        />
        <Select id="deposit-method" label="Method" options={[...PAYMENT_METHOD_OPTIONS]} value={method} onChange={setMethod} />
        {(ratesQuery.data?.rates.length ?? 0) > 0 ? (
          <Select
            id="deposit-currency"
            label="Currency"
            options={[{ value: base, label: base }, ...(ratesQuery.data?.rates ?? []).map((r) => ({ value: r.currency, label: r.currency }))]}
            value={currency ?? base}
            onChange={(v) => setCurrency(v === base ? null : v)}
          />
        ) : null}
        <Input id="deposit-reference" label="Reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} hint="Bank transfer ref, card auth code…" />
      </div>
      {owing > 0 && !rate ? (
        <button type="button" onClick={() => setAmount(owing.toFixed(2))} className="self-start text-small font-semibold text-surface-accent hover:underline cursor-pointer">
          The deposit still owed ({formatMoney(owing, symbol)})
        </button>
      ) : null}
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={close} disabled={mutation.isPending}>
          Cancel
        </Button>
        <Button type="button" onClick={save} loading={mutation.isPending} disabled={!(Number(amount) > 0) || !method}>
          Save Deposit
        </Button>
      </div>
    </Modal>
  );
}
