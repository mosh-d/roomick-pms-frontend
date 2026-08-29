'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api';
import { usePostChargeMutation, type ChargeType } from '@/lib/folios';
import { postChargeSchema, CHARGE_TYPE_OPTIONS, type PostChargeFormValues } from '@/lib/schemas/folios';

/**
 * "Post a Charge" (ref p33's Add Charge section). The reference shows a
 * per-charge **Tax Rule** multi-select; deliberately not built — tax rules
 * already declare which charge types they apply to
 * (`TaxRule.appliesToChargeTypes`), so the engine resolves them from the
 * charge type. Hand-picking per charge would let the two disagree, and the
 * resulting tax rows would no longer match the branch's own rules.
 *
 * One charge at a time rather than the reference's repeatable "Charge 1 /
 * Charge 2 / + Add charge" block: each post is its own transaction with
 * its own taxes, so batching would only be a UI convenience over the same
 * N calls. Noted as a deliberate trim, not an oversight.
 */
export function PostChargeForm({
  branchId,
  folioId,
  auth,
}: {
  branchId: string;
  folioId: string;
  auth: { accessToken: string | undefined; tenantId: string | undefined };
}) {
  const [formError, setFormError] = useState<string | null>(null);
  const mutation = usePostChargeMutation(branchId, folioId, auth);

  // The field's own hint claims "Defaults to today" — true only if
  // `defaultValues` (and the post-submit reset below) actually say so; an
  // empty string here left the field genuinely blank despite the hint.
  const today = () => new Date().toISOString().slice(0, 10);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PostChargeFormValues>({
    resolver: zodResolver(postChargeSchema),
    defaultValues: { chargeType: 'fnb', serviceDate: today() },
  });

  async function onSubmit(values: PostChargeFormValues) {
    setFormError(null);
    try {
      await mutation.mutateAsync({
        description: values.description,
        amount: values.amount,
        chargeType: values.chargeType as ChargeType,
        serviceDate: values.serviceDate || undefined,
      });
      // Charge type carries over (posting several of the same kind in a
      // row is the common case); description/amount/date all clear —
      // service date back to today, not blank, matching its own hint.
      reset({ chargeType: values.chargeType, description: '', amount: undefined, serviceDate: today() });
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <p className="text-small text-primary-dark/70">
        Manually post a charge for a service to this guest&apos;s folio. Tax is applied automatically from the branch&apos;s active tax rules.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        <Input label="Description" {...register('description')} error={errors.description?.message} />
        <Input
          label="Amount"
          type="number"
          step="0.01"
          min={0}
          {...register('amount', { valueAsNumber: true })}
          error={errors.amount?.message}
        />
        <Controller
          control={control}
          name="chargeType"
          render={({ field }) => (
            <Select
              id="post-charge-type"
              name="chargeType"
              label="Charge Type"
              options={[...CHARGE_TYPE_OPTIONS]}
              value={field.value || null}
              onChange={field.onChange}
              error={errors.chargeType?.message}
            />
          )}
        />
        <Input label="Service Date" type="date" {...register('serviceDate')} error={errors.serviceDate?.message} hint="Defaults to today" />
      </div>

      {formError ? <p className="text-small text-red-600">{formError}</p> : null}

      <Button type="submit" loading={isSubmitting || mutation.isPending} className="self-start">
        Post Charge
      </Button>
    </form>
  );
}
