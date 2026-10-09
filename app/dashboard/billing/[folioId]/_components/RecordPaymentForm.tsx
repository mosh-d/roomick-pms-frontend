'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api';
import { useExchangeRatesQuery, useRecordPaymentMutation, type PaymentMethod, type PaymentPurpose } from '@/lib/folios';
import { recordPaymentSchema, PAYMENT_METHOD_OPTIONS, PAYMENT_PURPOSE_OPTIONS, type RecordPaymentFormValues } from '@/lib/schemas/folios';
import { formatMoney } from '@/lib/numberFormat';

/**
 * Records a payment against the folio (ref p33's Payment section).
 * "Deposit" is offered as a purpose because deposits are **payments**, not
 * line items (spec §4.5) — they reduce the balance without ever appearing
 * in charges or revenue.
 *
 * A guest can pay in another currency the branch takes (Property Config →
 * Currencies): the amount is then in that currency, and the bill is credited
 * its worth at the branch's rate — the server's rate, never one typed here.
 */
export function RecordPaymentForm({
  branchId,
  folioId,
  auth,
  balanceDue,
  currencySymbol,
}: {
  branchId: string;
  folioId: string;
  auth: { accessToken: string | undefined; tenantId: string | undefined };
  balanceDue: string;
  currencySymbol: string;
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const mutation = useRecordPaymentMutation(branchId, folioId, auth);
  const ratesQuery = useExchangeRatesQuery(branchId, auth);
  const owed = Number(balanceDue);

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RecordPaymentFormValues>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: { method: 'card', paymentPurpose: 'payment', currency: '' },
  });

  const baseCurrency = ratesQuery.data?.baseCurrency ?? '';
  const rates = ratesQuery.data?.rates ?? [];
  const currency = watch('currency') || baseCurrency;
  const rate = rates.find((r) => r.currency === currency);
  const amount = watch('amount');
  const inBase = rate && Number.isFinite(amount) ? Math.round(amount * Number(rate.rate) * 100) / 100 : null;

  async function onSubmit(values: RecordPaymentFormValues) {
    setFormError(null);
    try {
      await mutation.mutateAsync({
        amount: values.amount,
        method: values.method as PaymentMethod,
        paymentPurpose: (values.paymentPurpose as PaymentPurpose) ?? 'payment',
        reference: values.reference || undefined,
        currency: values.currency && values.currency !== baseCurrency ? values.currency : undefined,
      });
      reset({ method: values.method, paymentPurpose: values.paymentPurpose, reference: '', currency: values.currency });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        <Input
          label={rate ? `Amount (${rate.currency})` : 'Amount'}
          type="number"
          step="0.01"
          min={0}
          {...register('amount', { valueAsNumber: true })}
          error={errors.amount?.message}
          hint={rate && inBase !== null ? `${formatMoney(inBase, currencySymbol)} at ${Number(rate.rate).toLocaleString('en-US', { maximumFractionDigits: 6 })}` : undefined}
        />
        {rates.length > 0 ? (
          <Controller
            control={control}
            name="currency"
            render={({ field }) => (
              <Select
                id="payment-currency"
                name="currency"
                label="Currency"
                options={[{ value: baseCurrency, label: baseCurrency }, ...rates.map((r) => ({ value: r.currency, label: r.currency }))]}
                value={field.value || baseCurrency}
                onChange={field.onChange}
              />
            )}
          />
        ) : null}
        <Controller
          control={control}
          name="method"
          render={({ field }) => (
            <Select
              id="payment-method"
              name="method"
              label="Payment Method"
              options={[...PAYMENT_METHOD_OPTIONS]}
              value={field.value || null}
              onChange={field.onChange}
              error={errors.method?.message}
            />
          )}
        />
        <Controller
          control={control}
          name="paymentPurpose"
          render={({ field }) => (
            <Select
              id="payment-purpose"
              name="paymentPurpose"
              label="Purpose"
              options={[...PAYMENT_PURPOSE_OPTIONS]}
              value={field.value ?? 'payment'}
              onChange={field.onChange}
              error={errors.paymentPurpose?.message}
            />
          )}
        />
        <Input label="Reference Number" {...register('reference')} error={errors.reference?.message} hint="Card authorization code, bank ref, etc." />
      </div>

      {owed > 0 ? (
        <button
          type="button"
          onClick={() => setValue('amount', rate ? Math.ceil((owed / Number(rate.rate)) * 100) / 100 : owed, { shouldValidate: true })}
          className="self-start text-small font-semibold text-surface-accent hover:underline cursor-pointer"
        >
          Pay full balance ({formatMoney(balanceDue, currencySymbol)}
          {rate ? ` ≈ ${rate.currency} ${(Math.ceil((owed / Number(rate.rate)) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}` : ''})
        </button>
      ) : null}

      {formError ? <p className="text-small text-red-600">{formError}</p> : null}

      <Button type="submit" loading={isSubmitting || mutation.isPending} className="self-start">
        Save Payment
      </Button>
    </form>
  );
}
