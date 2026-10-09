'use client';

import { useMemo, useState } from 'react';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { YesNoToggle } from '@/components/ui/YesNoToggle';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api';
import { currencySymbolFor, DEFAULT_CURRENCY_BY_COUNTRY } from '@/lib/currencies';
import { useExchangeRatesQuery, useRemoveExchangeRateMutation, useSetExchangeRateMutation } from '@/lib/folios';
import { formatMomentDate } from '@/lib/dates';
import {
  useSetDayUsePolicyMutation,
  useSetDepositPolicyMutation,
  useSetStayFeePolicyMutation,
  type BranchDetail,
  type DepositType,
  type StayFeePolicySettings,
} from '@/lib/propertyConfig';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

const DEPOSIT_OPTIONS: SelectOption[] = [
  { value: 'none', label: 'No deposit' },
  { value: 'first_night', label: 'The first night' },
  { value: 'percentage', label: 'A percentage of the stay' },
  { value: 'fixed', label: 'A fixed amount' },
];

/**
 * The deposit new bookings are asked for. Worked out when a stay is booked
 * and kept with it, so changing the policy doesn't move what guests already
 * booked were told. The deposit is taken on the stay's own bill before
 * arrival and goes towards the stay; if the booking is cancelled, the
 * cancellation charge comes out of it and the rest is a refund owed.
 */
export function DepositPolicySection({ branch, auth }: { branch: BranchDetail; auth: AuthOpts }) {
  const mutation = useSetDepositPolicyMutation(branch.id, auth);
  const current = branch.depositPolicy;
  const [type, setType] = useState<DepositType>(current?.type ?? 'none');
  const [value, setValue] = useState(current?.value ? String(current.value) : '');
  const [dueDays, setDueDays] = useState(String(current?.dueDaysBeforeArrival ?? 0));
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const symbol = currencySymbolFor(branch.currency);

  const needsValue = type === 'percentage' || type === 'fixed';
  const valueOk = !needsValue || (Number(value) > 0 && (type !== 'percentage' || Number(value) <= 100));
  const daysOk = /^\d+$/.test(dueDays) && Number(dueDays) <= 365;

  function edited() {
    setSaved(false);
    setError(null);
  }

  function save() {
    mutation.mutate(
      { type, value: needsValue ? Number(value) : undefined, dueDaysBeforeArrival: Number(dueDays || 0) },
      { onSuccess: () => setSaved(true), onError: (e) => setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.') },
    );
  }

  return (
    <Section label="Deposit Policy">
      <Card tone="secondary" className="flex flex-col gap-3 max-w-lg">
        <Select id="deposit-type" label="Ask new bookings for" options={DEPOSIT_OPTIONS} value={type} onChange={(v) => { setType(v as DepositType); edited(); }} />
        {needsValue ? (
          <Input
            id="deposit-value"
            label={type === 'percentage' ? 'Percentage of the stay (tax included)' : `Amount (${symbol})`}
            type="number"
            min={0}
            max={type === 'percentage' ? 100 : undefined}
            step="0.01"
            value={value}
            onChange={(e) => { setValue(e.target.value); edited(); }}
          />
        ) : null}
        {type !== 'none' ? (
          <Input
            id="deposit-due-days"
            label="Due (days before arrival)"
            type="number"
            min={0}
            max={365}
            hint="0 means by arrival. A booking made closer in than this owes it at once."
            value={dueDays}
            onChange={(e) => { setDueDays(e.target.value); edited(); }}
          />
        ) : null}
        <p className="text-tiny text-surface-muted">
          New bookings are told the deposit and its due date in their confirmation; bookings already made keep what they were asked. Take a deposit from the booking&apos;s row on Arrivals or Modify Reservation.
        </p>
        {error ? <p className="text-small text-red-600">{error}</p> : null}
        {saved ? <p className="text-small text-green-700">Saved.</p> : null}
        <div>
          <Button type="button" onClick={save} disabled={mutation.isPending || !valueOk || !daysOk}>
            {mutation.isPending ? 'Saving…' : 'Save Deposit Policy'}
          </Button>
        </div>
      </Card>
    </Section>
  );
}

const LATE_OPTIONS: SelectOption[] = [
  { value: 'flat', label: 'A flat fee' },
  { value: 'percent_of_night', label: 'A share of the last night' },
];
const EARLY_OPTIONS: SelectOption[] = [
  { value: 'flat', label: 'A flat fee' },
  { value: 'first_night', label: 'One night' },
  { value: 'percent_of_remaining', label: 'A share of the nights given up' },
];

/**
 * What leaving late, or before the booked last night, costs. The fee is
 * added to the bill at check-out, where the desk sees it first and a
 * manager can waive it (with a reason, kept in the audit trail).
 */
export function StayFeePolicySection({ branch, auth }: { branch: BranchDetail; auth: AuthOpts }) {
  const mutation = useSetStayFeePolicyMutation(branch.id, auth);
  const late = branch.stayFeePolicy?.lateCheckout ?? null;
  const early = branch.stayFeePolicy?.earlyDeparture ?? null;
  const [lateOn, setLateOn] = useState(late !== null);
  const [lateType, setLateType] = useState<'flat' | 'percent_of_night'>(late?.feeType ?? 'flat');
  const [lateAmount, setLateAmount] = useState(late ? String(late.amount) : '');
  const [grace, setGrace] = useState(String(late?.graceMinutes ?? 30));
  const [earlyOn, setEarlyOn] = useState(early !== null);
  const [earlyType, setEarlyType] = useState<'flat' | 'first_night' | 'percent_of_remaining'>(early?.feeType ?? 'first_night');
  const [earlyAmount, setEarlyAmount] = useState(early?.amount ? String(early.amount) : '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const symbol = currencySymbolFor(branch.currency);
  const checkOutTime = branch.checkOutTime.slice(11, 16);

  const lateOk = !lateOn || (Number(lateAmount) > 0 && (lateType !== 'percent_of_night' || Number(lateAmount) <= 100) && /^\d+$/.test(grace) && Number(grace) <= 720);
  const earlyOk = !earlyOn || earlyType === 'first_night' || (Number(earlyAmount) > 0 && (earlyType !== 'percent_of_remaining' || Number(earlyAmount) <= 100));

  function edited() {
    setSaved(false);
    setError(null);
  }

  function save() {
    const body: StayFeePolicySettings = {
      lateCheckout: lateOn ? { feeType: lateType, amount: Number(lateAmount), graceMinutes: Number(grace) } : null,
      earlyDeparture: earlyOn ? { feeType: earlyType, amount: earlyType === 'first_night' ? null : Number(earlyAmount) } : null,
    };
    mutation.mutate(body, { onSuccess: () => setSaved(true), onError: (e) => setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.') });
  }

  return (
    <Section label="Late Check-Out & Early Departure">
      <Card tone="secondary" className="flex flex-col gap-3 max-w-lg">
        <YesNoToggle label="Charge for a late check-out" name="lateCheckoutOn" value={lateOn ? 'yes' : 'no'} onChange={(v) => { setLateOn(v === 'yes'); edited(); }} />
        {lateOn ? (
          <>
            <Select id="late-fee-type" label="Late check-out fee" options={LATE_OPTIONS} value={lateType} onChange={(v) => { setLateType(v as 'flat' | 'percent_of_night'); edited(); }} />
            <Input
              id="late-fee-amount"
              label={lateType === 'flat' ? `Amount (${symbol})` : 'Percentage of the last night'}
              type="number"
              min={0}
              step="0.01"
              value={lateAmount}
              onChange={(e) => { setLateAmount(e.target.value); edited(); }}
            />
            <Input
              id="late-fee-grace"
              label="Grace (minutes after check-out time)"
              type="number"
              min={0}
              max={720}
              hint={`Check-out time is ${checkOutTime}. The fee applies to a check-out after it, plus this grace.`}
              value={grace}
              onChange={(e) => { setGrace(e.target.value); edited(); }}
            />
          </>
        ) : null}
        <YesNoToggle label="Charge for leaving early" name="earlyDepartureOn" value={earlyOn ? 'yes' : 'no'} onChange={(v) => { setEarlyOn(v === 'yes'); edited(); }} />
        {earlyOn ? (
          <>
            <Select
              id="early-fee-type"
              label="Early departure fee"
              options={EARLY_OPTIONS}
              value={earlyType}
              onChange={(v) => { setEarlyType(v as 'flat' | 'first_night' | 'percent_of_remaining'); edited(); }}
            />
            {earlyType !== 'first_night' ? (
              <Input
                id="early-fee-amount"
                label={earlyType === 'flat' ? `Amount (${symbol})` : 'Percentage of the nights given up'}
                type="number"
                min={0}
                step="0.01"
                value={earlyAmount}
                onChange={(e) => { setEarlyAmount(e.target.value); edited(); }}
              />
            ) : null}
          </>
        ) : null}
        <p className="text-tiny text-surface-muted">Charged at check-out as a penalty on the guest&apos;s bill. The desk sees the fee before confirming, and a manager can waive it there.</p>
        {error ? <p className="text-small text-red-600">{error}</p> : null}
        {saved ? <p className="text-small text-green-700">Saved.</p> : null}
        <div>
          <Button type="button" onClick={save} disabled={mutation.isPending || !lateOk || !earlyOk}>
            {mutation.isPending ? 'Saving…' : 'Save Check-Out Fees'}
          </Button>
        </div>
      </Card>
    </Section>
  );
}

/**
 * Other currencies the branch takes payment in, and what one unit of each is
 * worth in the branch's own. The desk picks the currency when taking a
 * payment; the bill is credited at the rate set here, and each payment keeps
 * the rate it was taken at.
 */
export function CurrenciesSection({ branch, auth }: { branch: BranchDetail; auth: AuthOpts }) {
  const ratesQuery = useExchangeRatesQuery(branch.id, auth);
  const setMutation = useSetExchangeRateMutation(branch.id, auth);
  const removeMutation = useRemoveExchangeRateMutation(branch.id, auth);
  const [currency, setCurrency] = useState<string | null>(null);
  const [rate, setRate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const symbol = currencySymbolFor(branch.currency);

  const options: SelectOption[] = useMemo(() => {
    const codes = new Set(Object.values(DEFAULT_CURRENCY_BY_COUNTRY));
    codes.delete(branch.currency);
    return [...codes].sort().map((code) => ({ value: code, label: code }));
  }, [branch.currency]);

  function save() {
    if (!currency) return;
    setError(null);
    setMutation.mutate(
      { currency, rate: Number(rate) },
      {
        onSuccess: () => {
          setCurrency(null);
          setRate('');
        },
        onError: (e) => setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'),
      },
    );
  }

  const rates = ratesQuery.data?.rates ?? [];
  return (
    <Section label="Currencies">
      <Card tone="secondary" className="flex flex-col gap-3 max-w-lg">
        <p className="text-small text-surface">
          Bills are in {branch.currency}. Add another currency to take payment in it; the bill is credited its worth at your rate.
        </p>
        {rates.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {rates.map((r) => (
              <li key={r.currency} className="flex flex-wrap items-center justify-between gap-2 border-b border-secondary/20 pb-2 last:border-0">
                <span className="text-small text-surface">
                  <span className="font-semibold">1 {r.currency}</span> = {symbol}
                  {Number(r.rate).toLocaleString('en-US', { maximumFractionDigits: 6 })}
                  <span className="text-tiny text-surface-muted"> · set {formatMomentDate(r.updatedAt, { day: 'numeric', month: 'short' })}</span>
                </span>
                <span className="flex items-center gap-2">
                  <Button type="button" size="sm" variant="outline" onClick={() => { setCurrency(r.currency); setRate(r.rate); }}>
                    Change
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => removeMutation.mutate(r.currency)} loading={removeMutation.isPending && removeMutation.variables === r.currency}>
                    Stop Taking
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-small text-surface-muted">Only {branch.currency} is taken.</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <Select id="rate-currency" label="Currency" options={options} value={currency} onChange={(v) => { setCurrency(v); setError(null); }} placeholder="Pick a currency" />
          <Input
            id="rate-value"
            label={`${symbol || branch.currency} per one ${currency ?? 'unit'}`}
            type="number"
            min={0}
            step="0.000001"
            value={rate}
            onChange={(e) => { setRate(e.target.value); setError(null); }}
          />
        </div>
        {error ? <p className="text-small text-red-600">{error}</p> : null}
        <div>
          <Button type="button" onClick={save} disabled={!currency || !(Number(rate) > 0) || setMutation.isPending}>
            {setMutation.isPending ? 'Saving…' : rates.some((r) => r.currency === currency) ? 'Update Rate' : 'Add Currency'}
          </Button>
        </div>
      </Card>
    </Section>
  );
}

/**
 * Day use: a room for the day, not the night — sold at each room type's own
 * day-use rate (set on the room type) during these hours. The nights either
 * side stay on sale; a guest still in at the night audit is charged the night.
 */
export function DayUseSection({ branch, auth }: { branch: BranchDetail; auth: AuthOpts }) {
  const mutation = useSetDayUsePolicyMutation(branch.id, auth);
  const [enabled, setEnabled] = useState(branch.dayUsePolicy !== null);
  const [from, setFrom] = useState(branch.dayUsePolicy?.from ?? '10:00');
  const [until, setUntil] = useState(branch.dayUsePolicy?.until ?? '17:00');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function save() {
    mutation.mutate(enabled ? { enabled, from, until } : { enabled }, {
      onSuccess: () => setSaved(true),
      onError: (e) => setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'),
    });
  }

  return (
    <Section label="Day Use">
      <Card tone="secondary" className="flex flex-col gap-3 max-w-lg">
        <YesNoToggle label="Sell rooms for the day" name="dayUseEnabled" value={enabled ? 'yes' : 'no'} onChange={(v) => { setEnabled(v === 'yes'); setSaved(false); setError(null); }} />
        {enabled ? (
          <div className="grid grid-cols-2 gap-3">
            <Input id="day-use-from" label="From" type="time" value={from} onChange={(e) => { setFrom(e.target.value); setSaved(false); }} />
            <Input id="day-use-until" label="Until" type="time" value={until} onChange={(e) => { setUntil(e.target.value); setSaved(false); }} />
          </div>
        ) : null}
        <p className="text-tiny text-surface-muted">Each room type sells day use at its own day-use rate — set it on the room type. A day-use booking is made from Create Reservation or Walk-In.</p>
        {error ? <p className="text-small text-red-600">{error}</p> : null}
        {saved ? <p className="text-small text-green-700">Saved.</p> : null}
        <div>
          <Button type="button" onClick={save} disabled={mutation.isPending || (enabled && !(from && until && until > from))}>
            {mutation.isPending ? 'Saving…' : 'Save Day Use'}
          </Button>
        </div>
      </Card>
    </Section>
  );
}
