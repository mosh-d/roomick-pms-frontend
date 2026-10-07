import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { folioQueryKey, type PaymentMethod } from './folios';
import { reservationsQueryKey } from './reservations';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

export type RefundStatus = 'pending' | 'approved' | 'rejected' | 'processed';
/** The ways money goes back — the backend's `REFUND_METHODS`. */
export type RefundMethod = Extract<PaymentMethod, 'cash' | 'card' | 'bank_transfer'>;
export const REFUND_METHOD_OPTIONS: Array<{ value: RefundMethod; label: string }> = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank transfer' },
];

/** Mirrors `RefundsService`'s `REFUND_INCLUDE` (roomick-pms-backend/src/modules/folios/refunds.service.ts). */
export interface Refund {
  id: string;
  folioId: string;
  paymentId: string | null;
  amount: string;
  reason: string;
  status: RefundStatus;
  method: RefundMethod;
  rejectionReason: string | null;
  processedAt: string | null;
  createdAt: string;
  currency: string;
  folio: {
    id: string;
    label: string | null;
    branchId: string;
    guest: { id: string; name: string };
    reservation: { id: string; confirmationNumber: string; room: { number: string } | null } | null;
  };
  payment: { id: string; method: PaymentMethod; amount: string; recordedAt: string; reference: string | null } | null;
  requestedByUser: { id: string; name: string } | null;
  approvedByUser: { id: string; name: string } | null;
  processedByUser: { id: string; name: string } | null;
}

const KEY = (branchId: string) => ['refunds', branchId] as const;

export function useRefundsQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: KEY(branchId ?? ''),
    queryFn: () => apiFetch<Refund[]>(`/branches/${branchId}/refunds`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

/** A refund changes what a bill holds — its detail, every balance list, and the refund lists. */
function invalidate(queryClient: ReturnType<typeof useQueryClient>, branchId: string, folioId: string) {
  queryClient.invalidateQueries({ queryKey: KEY(branchId) });
  queryClient.invalidateQueries({ queryKey: folioQueryKey(folioId) });
  queryClient.invalidateQueries({ queryKey: ['folios', branchId] });
  queryClient.invalidateQueries({ queryKey: ['reservation-folios'] });
  queryClient.invalidateQueries({ queryKey: reservationsQueryKey('inHouse', branchId) });
}

export function useRequestRefundMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ folioId, ...body }: { folioId: string; amount: number; method?: RefundMethod; paymentId?: string; reason: string }) =>
      apiFetch<Refund>(`/folios/${folioId}/refunds`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: (_data, variables) => invalidate(queryClient, branchId, variables.folioId),
  });
}

export function useRefundActionMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ refund, action, reason }: { refund: Refund; action: 'approve' | 'reject' | 'pay-out'; reason?: string }) =>
      apiFetch<Refund>(`/refunds/${refund.id}/${action}`, { method: 'POST', accessToken, tenantId, body: action === 'reject' ? { reason } : undefined }),
    onSuccess: (_data, { refund }) => invalidate(queryClient, branchId, refund.folioId),
  });
}
