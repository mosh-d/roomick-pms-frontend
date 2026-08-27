import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { reservationsQueryKey } from './reservations';
import type { GuestSummary } from './guests';

export type ChargeType = 'room' | 'fnb' | 'spa' | 'laundry' | 'minibar' | 'transport' | 'tax' | 'penalty' | 'correction' | 'misc';
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'voucher' | 'loyalty_points';
export type PaymentPurpose = 'payment' | 'deposit' | 'deposit_application';
export type FolioStatus = 'pending' | 'open' | 'settled' | 'disputed';

/**
 * Guest Ledger vs City Ledger, derived server-side from reservation status
 * + balance (see `FoliosService.deriveGuestStatus`). `city_ledger` = the
 * guest has departed and still owes — a collections matter, never a block.
 */
export type FolioGuestStatus = 'in_house' | 'city_ledger' | null;

/** Money arrives as strings (Prisma `Decimal` serialised) — never parse to a float for arithmetic, only for display. */
export interface LineItem {
  id: string;
  description: string;
  amount: string;
  taxAmount: string;
  chargeType: ChargeType;
  serviceDate: string | null;
  postedAt: string;
  isVoid: boolean;
  taxRuleIds: string[];
}

export interface FolioPayment {
  id: string;
  amount: string;
  method: PaymentMethod;
  currency: string;
  reference: string | null;
  paymentPurpose: PaymentPurpose;
  recordedAt: string;
  isVoid: boolean;
}

export interface FolioTotals {
  subTotal: string;
  taxTotal: string;
  totalCost: string;
  paymentsTotal: string;
  depositsTotal: string;
  balanceDue: string;
}

export interface FolioDetail {
  id: string;
  status: FolioStatus;
  openedAt: string | null;
  closedAt: string | null;
  guest: GuestSummary;
  reservation: {
    id: string;
    confirmationNumber: string;
    status: string;
    checkInDate: string;
    checkOutDate: string;
    confirmedRate: string;
    roomType: { id: string; name: string };
    room: { id: string; number: string } | null;
  } | null;
  lineItems: LineItem[];
  payments: FolioPayment[];
  totals: FolioTotals;
  guestStatus: FolioGuestStatus;
}

export interface FolioListRow {
  id: string;
  status: FolioStatus;
  openedAt: string | null;
  closedAt: string | null;
  guest: { id: string; name: string };
  reservation: { id: string; confirmationNumber: string; status: string; checkOutDate: string; room: { number: string } | null } | null;
  balanceDue: string;
  guestStatus: FolioGuestStatus;
}

export interface TaxBreakdownRow {
  ruleId: string;
  ruleName: string;
  rate: string;
  taxableBase: string;
  taxCollected: string;
}

export type FolioFilter = 'all' | 'outstanding' | 'overdue';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

export function folioQueryKey(folioId: string) {
  return ['folio', folioId] as const;
}
export function foliosListQueryKey(branchId: string, filter: FolioFilter) {
  return ['folios', branchId, filter] as const;
}

export function useFolioQuery(folioId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: folioQueryKey(folioId ?? ''),
    queryFn: () => apiFetch<FolioDetail>(`/folios/${folioId}`, { accessToken, tenantId }),
    enabled: folioId !== null,
  });
}

export function useTaxBreakdownQuery(folioId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['folio-tax-breakdown', folioId] as const,
    queryFn: () => apiFetch<{ rows: TaxBreakdownRow[]; totalTax: string }>(`/folios/${folioId}/tax-breakdown`, { accessToken, tenantId }),
    enabled: folioId !== null,
  });
}

export function useFoliosQuery(branchId: string | null, filter: FolioFilter, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: foliosListQueryKey(branchId ?? '', filter),
    queryFn: () => apiFetch<FolioListRow[]>(`/branches/${branchId}/folios?filter=${filter}`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

/** Everything that moves money invalidates the folio, every folio list, and the in-house list (which shows live balances). */
function invalidateMoney(queryClient: ReturnType<typeof useQueryClient>, branchId: string, folioId: string) {
  queryClient.invalidateQueries({ queryKey: folioQueryKey(folioId) });
  queryClient.invalidateQueries({ queryKey: ['folio-tax-breakdown', folioId] });
  queryClient.invalidateQueries({ queryKey: ['folios', branchId] });
  queryClient.invalidateQueries({ queryKey: reservationsQueryKey('inHouse', branchId) });
}

export function usePostChargeMutation(branchId: string, folioId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { description: string; amount: number; chargeType: ChargeType; serviceDate?: string }) =>
      apiFetch<LineItem>(`/folios/${folioId}/charges`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => invalidateMoney(queryClient, branchId, folioId),
  });
}

export function useRecordPaymentMutation(branchId: string, folioId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { amount: number; method: PaymentMethod; paymentPurpose?: PaymentPurpose; reference?: string }) =>
      apiFetch<FolioPayment>(`/folios/${folioId}/payments`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => invalidateMoney(queryClient, branchId, folioId),
  });
}

export function useCorrectLineItemMutation(branchId: string, folioId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lineItemId, reason }: { lineItemId: string; reason: string }) =>
      apiFetch<LineItem>(`/line-items/${lineItemId}/correct`, { method: 'POST', accessToken, tenantId, body: { reason } }),
    onSuccess: () => invalidateMoney(queryClient, branchId, folioId),
  });
}

export function useCloseFolioMutation(branchId: string, folioId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<FolioDetail>(`/folios/${folioId}/close`, { method: 'POST', accessToken, tenantId }),
    onSuccess: () => invalidateMoney(queryClient, branchId, folioId),
  });
}
