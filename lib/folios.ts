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
/** `refund_due` — the bill holds a credit: the guest is owed money, and it can't close until it goes back. */
export type FolioGuestStatus = 'in_house' | 'city_ledger' | 'refund_due' | null;

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
  /** Tax lines only: the charge this tax was computed on — it's corrected and split together with that charge. `null` on charges, and on tax posted before the link existed. */
  parentLineItemId: string | null;
  /** Reversal lines only: the line this one reverses. A line can be corrected once. */
  correctsLineItemId: string | null;
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
  /** `null` on the reservation's primary folio; every additional folio is named (see `createAdditionalFolio`). */
  label: string | null;
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
  /** The branch's ISO 4217 code — feed to `currencySymbolFor` for display. */
  currency: string;
  guestStatus: FolioGuestStatus;
}

export interface FolioListRow {
  id: string;
  /** `null` on the primary folio; a split folio's own name (e.g. "Company"). */
  label: string | null;
  status: FolioStatus;
  openedAt: string | null;
  closedAt: string | null;
  guest: { id: string; name: string };
  reservation: { id: string; confirmationNumber: string; status: string; checkOutDate: string; room: { number: string } | null } | null;
  balanceDue: string;
  currency: string;
  guestStatus: FolioGuestStatus;
}

export interface TaxBreakdownRow {
  ruleId: string;
  ruleName: string;
  type: 'percentage' | 'fixed';
  rate: string;
  /** Fixed rules: the amount per charge. */
  fixedAmount: string | null;
  /** The tax was inside the prices rather than added on top. */
  inclusive: boolean;
  taxableBase: string;
  taxCollected: string;
}

/** `in_house` — open bills of guests currently checked in (what the front-desk pages need, not every bill ever); `refund_due` — credits owed to guests. */
export type FolioFilter = 'all' | 'outstanding' | 'overdue' | 'in_house' | 'refund_due';

/** One end of a transfer, named the way the desk knows it: whose bill, which room. */
export interface TransferEnd {
  id: string;
  label: string | null;
  status: FolioStatus;
  reservationId: string;
  guest: { id: string; name: string };
  reservation: { id: string; confirmationNumber: string; room: { number: string } | null };
}

/** Mirrors the backend's `TRANSFER_INCLUDE` (roomick-pms-backend/src/modules/folios/folios.service.ts). */
export interface FolioTransfer {
  id: string;
  sourceFolioId: string;
  targetFolioId: string;
  lineItemIds: string[];
  amount: string;
  reason: string;
  createdAt: string;
  reversedAt: string | null;
  sourceFolio?: TransferEnd;
  targetFolio?: TransferEnd;
  /** Whoever made the move. */
  approvedByUser?: { id: string; name: string } | null;
  reversedByUser?: { id: string; name: string } | null;
  /** On Transfer History's rows: the branch's ISO 4217 code. */
  currency?: string;
}

/** A transfer can be put back for a day, by a manager — the backend's own window. */
export const TRANSFER_REVERSAL_WINDOW_MS = 24 * 60 * 60 * 1000;

/** The line a tax line or correction belongs to — it only ever moves with it. `null` for a charge, and for lines posted before the links existed. */
export function anchorOf(item: LineItem): string | null {
  if (item.chargeType === 'tax' && item.parentLineItemId) return item.parentLineItemId;
  return item.correctsLineItemId ?? null;
}

/**
 * The lines that really move when `pickedIds` move: each picked charge with
 * its tax, its correction and the correction's tax — the backend's own rule
 * (`FoliosService.withDependents`), mirrored so a preview shows what will
 * actually move.
 */
export function linesMovingWith(lineItems: LineItem[], pickedIds: Set<string>): LineItem[] {
  const live = lineItems.filter((li) => !li.isVoid);
  const moving = new Set(pickedIds);
  let grew = true;
  while (grew) {
    grew = false;
    for (const li of live) {
      if (moving.has(li.id)) continue;
      if ((li.parentLineItemId && moving.has(li.parentLineItemId)) || (li.correctsLineItemId && moving.has(li.correctsLineItemId))) {
        moving.add(li.id);
        grew = true;
      }
    }
  }
  return live.filter((li) => moving.has(li.id));
}

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


/** A stay's bills, main bill first (`FoliosService.listFoliosForReservation`). */
export interface ReservationFolio {
  id: string;
  /** `null` on the stay's main bill. */
  label: string | null;
  status: FolioStatus;
  payerName: string | null;
  corporateAccount: { id: string; name: string } | null;
  balanceDue: string;
  openedAt: string | null;
}

export function useReservationFoliosQuery(reservationId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['reservation-folios', reservationId] as const,
    queryFn: () => apiFetch<ReservationFolio[]>(`/reservations/${reservationId}/folios`, { accessToken, tenantId }),
    enabled: reservationId !== null,
  });
}

export function useTransferHistoryQuery(folioId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['folio-transfers', folioId] as const,
    queryFn: () => apiFetch<FolioTransfer[]>(`/folios/${folioId}/transfer-history`, { accessToken, tenantId }),
    enabled: folioId !== null,
  });
}

export function useCreateFolioMutation(branchId: string, reservationId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { label: string; payerName?: string; corporateAccountId?: string }) =>
      apiFetch<FolioDetail>(`/reservations/${reservationId}/folios`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservation-folios', reservationId] });
      queryClient.invalidateQueries({ queryKey: ['folios', branchId] });
    },
  });
}

/** Every move of charges at the branch, newest first — Transfer History. */
export function useBranchTransfersQuery(branchId: string | null, range: { from?: string; to?: string }, { accessToken, tenantId }: AuthOpts) {
  const params = new URLSearchParams();
  if (range.from) params.set('from', range.from);
  if (range.to) params.set('to', range.to);
  return useQuery({
    queryKey: ['branch-folio-transfers', branchId, range.from ?? null, range.to ?? null] as const,
    queryFn: () => apiFetch<FolioTransfer[]>(`/branches/${branchId}/folio-transfers${params.size ? `?${params.toString()}` : ''}`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

/** After charges move, both bills, every balance list and every transfer list are stale. */
function invalidateMoves(queryClient: ReturnType<typeof useQueryClient>, branchId: string, folioIds: string[]) {
  for (const folioId of folioIds) {
    queryClient.invalidateQueries({ queryKey: folioQueryKey(folioId) });
    queryClient.invalidateQueries({ queryKey: ['folio-tax-breakdown', folioId] });
  }
  queryClient.invalidateQueries({ queryKey: ['reservation-folios'] });
  queryClient.invalidateQueries({ queryKey: ['folios', branchId] });
  queryClient.invalidateQueries({ queryKey: ['folio-transfers'] });
  queryClient.invalidateQueries({ queryKey: ['branch-folio-transfers', branchId] });
  queryClient.invalidateQueries({ queryKey: reservationsQueryKey('inHouse', branchId) });
}

/**
 * Folio Transfer: charges (or every charge) onto another open bill. Within
 * one stay it's the split the front desk makes; onto another stay's bill
 * it's a transfer, which the backend only lets a manager, the owner or an
 * accountant make.
 */
export function useMoveChargesMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceFolioId,
      sameStay,
      ...body
    }: {
      sourceFolioId: string;
      sameStay: boolean;
      targetFolioId: string;
      lineItemIds?: string[];
      transferAll?: boolean;
      reason: string;
    }) => apiFetch<FolioTransfer>(`/folios/${sourceFolioId}/${sameStay ? 'split' : 'transfer'}`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: (_data, variables) => invalidateMoves(queryClient, branchId, [variables.sourceFolioId, variables.targetFolioId]),
  });
}

export function useReverseTransferMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (transfer: FolioTransfer) => apiFetch<FolioTransfer>(`/folio-transfers/${transfer.id}/reverse`, { method: 'POST', accessToken, tenantId }),
    onSuccess: (_data, transfer) => invalidateMoves(queryClient, branchId, [transfer.sourceFolioId, transfer.targetFolioId]),
  });
}

/** A split moves charges between two folios, so BOTH folios' detail queries and every list showing a balance go stale. */
export function useSplitFolioMutation(branchId: string, reservationId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ sourceFolioId, targetFolioId, lineItemIds, reason }: { sourceFolioId: string; targetFolioId: string; lineItemIds: string[]; reason: string }) =>
      apiFetch<FolioTransfer>(`/folios/${sourceFolioId}/split`, {
        method: 'POST', accessToken, tenantId, body: { targetFolioId, lineItemIds, reason },
      }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: folioQueryKey(variables.sourceFolioId) });
      queryClient.invalidateQueries({ queryKey: folioQueryKey(variables.targetFolioId) });
      queryClient.invalidateQueries({ queryKey: ['reservation-folios', reservationId] });
      queryClient.invalidateQueries({ queryKey: ['folios', branchId] });
    },
  });
}
