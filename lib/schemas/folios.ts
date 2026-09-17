import { z } from 'zod';

/** Mirrors `PostChargeDto` — `tax` and `correction` are excluded on the backend too (tax rows are written by the engine, corrections by their own endpoint). */
export const CHARGE_TYPE_OPTIONS = [
  { value: 'room', label: 'Room' },
  { value: 'fnb', label: 'Food & Drink' },
  { value: 'spa', label: 'Spa' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'minibar', label: 'Minibar' },
  { value: 'transport', label: 'Transport' },
  { value: 'penalty', label: 'Penalty' },
  { value: 'misc', label: 'Miscellaneous' },
] as const;

/** No "Loyalty Points" here: points are paid with through Redeem Points on the bill, which takes them off the guest's balance. */
export const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'voucher', label: 'Voucher' },
] as const;

export const PAYMENT_PURPOSE_OPTIONS = [
  { value: 'payment', label: 'Payment' },
  { value: 'deposit', label: 'Deposit' },
] as const;

const CHARGE_TYPE_VALUES = CHARGE_TYPE_OPTIONS.map((o) => o.value) as [string, ...string[]];
const PAYMENT_METHOD_VALUES = PAYMENT_METHOD_OPTIONS.map((o) => o.value) as [string, ...string[]];
const PAYMENT_PURPOSE_VALUES = PAYMENT_PURPOSE_OPTIONS.map((o) => o.value) as [string, ...string[]];

export const postChargeSchema = z.object({
  description: z.string().trim().min(1, 'Required').max(300),
  amount: z.number({ message: 'Required' }).positive('Must be greater than zero'),
  chargeType: z.enum(CHARGE_TYPE_VALUES, { message: 'Pick a charge type' }),
  serviceDate: z.string().optional().or(z.literal('')),
});
export type PostChargeFormValues = z.infer<typeof postChargeSchema>;

export const recordPaymentSchema = z.object({
  amount: z.number({ message: 'Required' }).positive('Must be greater than zero'),
  method: z.enum(PAYMENT_METHOD_VALUES, { message: 'Pick a payment method' }),
  paymentPurpose: z.enum(PAYMENT_PURPOSE_VALUES).optional(),
  reference: z.string().trim().max(100).optional().or(z.literal('')),
});
export type RecordPaymentFormValues = z.infer<typeof recordPaymentSchema>;
