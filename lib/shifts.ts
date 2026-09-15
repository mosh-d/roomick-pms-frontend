import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

export type ShiftType = 'morning' | 'evening' | 'night';
export type IssuePriority = 'low' | 'medium' | 'high' | 'urgent';
export type IssueStatus = 'open' | 'resolved' | 'carried_over';

export interface CashDenomination {
  denomination: number;
  count: number;
}

/** Mirrors `ShiftIssue` (roomick-pms-backend/prisma/schema.prisma). */
export interface ShiftIssue {
  id: string;
  shiftId: string;
  description: string;
  priority: IssuePriority;
  status: IssueStatus;
  resolution: string | null;
  resolvedBy: string | null;
  createdAt: string;
  resolvedAt: string | null;
  shift?: { id: string; shiftType: ShiftType; openedAt: string; agent: { name: string } };
}

/** Mirrors `Shift` (roomick-pms-backend/prisma/schema.prisma). Decimal columns arrive as strings. */
export interface Shift {
  id: string;
  branchId: string;
  agentId: string;
  shiftType: ShiftType;
  openedAt: string;
  closedAt: string | null;
  openingFloat: string;
  openingBreakdown: CashDenomination[] | null;
  systemCashTotal: string | null;
  closingCashCounted: string | null;
  closingBreakdown: CashDenomination[] | null;
  variance: string | null;
  varianceExplanation: string | null;
  handoverNotes: string | null;
  agent?: { id: string; name: string };
  issues?: ShiftIssue[];
  payments?: Array<{ id: string; method: string; amount: string; recordedAt: string }>;
  /** Point of Sale cash sales rung up this shift, voids excluded — the same drawer as `payments` (`getShift`). */
  posOrders?: Array<{ id: string; orderNo: number; total: string; createdAt: string; outlet: { name: string } }>;
}

export interface HandoverContext {
  lastClosedShift: Shift | null;
  unresolvedIssues: ShiftIssue[];
}

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

export function useCurrentShiftQuery(branchId: string | null, auth: AuthOpts) {
  return useQuery({
    queryKey: ['shift-current', branchId] as const,
    queryFn: () => apiFetch<Shift | null>(`/branches/${branchId}/shifts/current`, auth),
    enabled: branchId !== null,
  });
}

export function useHandoverContextQuery(branchId: string | null, auth: AuthOpts) {
  return useQuery({
    queryKey: ['shift-handover', branchId] as const,
    queryFn: () => apiFetch<HandoverContext>(`/branches/${branchId}/shifts/handover`, auth),
    enabled: branchId !== null,
  });
}

export function useShiftHistoryQuery(branchId: string | null, auth: AuthOpts) {
  return useQuery({
    queryKey: ['shift-history', branchId] as const,
    queryFn: () => apiFetch<Shift[]>(`/branches/${branchId}/shifts`, auth),
    enabled: branchId !== null,
  });
}

export function useShiftQuery(shiftId: string | null, auth: AuthOpts) {
  return useQuery({
    queryKey: ['shift', shiftId] as const,
    queryFn: () => apiFetch<Shift>(`/shifts/${shiftId}`, auth),
    enabled: shiftId !== null,
  });
}

function invalidateShiftQueries(queryClient: ReturnType<typeof useQueryClient>, branchId: string) {
  queryClient.invalidateQueries({ queryKey: ['shift-current', branchId] });
  queryClient.invalidateQueries({ queryKey: ['shift-history', branchId] });
  queryClient.invalidateQueries({ queryKey: ['shift-handover', branchId] });
}

export function useOpenShiftMutation(branchId: string, auth: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { shiftType: ShiftType; openingFloat: number; openingBreakdown?: CashDenomination[] }) =>
      apiFetch<Shift>(`/branches/${branchId}/shifts/open`, { method: 'POST', ...auth, body }),
    onSuccess: () => invalidateShiftQueries(queryClient, branchId),
  });
}

export function useCloseShiftMutation(branchId: string, auth: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      shiftId,
      ...body
    }: {
      shiftId: string;
      closingCashCounted: number;
      closingBreakdown?: CashDenomination[];
      varianceExplanation?: string;
      handoverNotes?: string;
      unresolvedIssues?: Array<{ description: string; priority?: IssuePriority }>;
    }) => apiFetch<Shift>(`/shifts/${shiftId}/close`, { method: 'POST', ...auth, body }),
    onSuccess: () => invalidateShiftQueries(queryClient, branchId),
  });
}

export function useAddShiftIssueMutation(branchId: string, auth: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shiftId, ...body }: { shiftId: string; description: string; priority?: IssuePriority }) =>
      apiFetch<ShiftIssue>(`/shifts/${shiftId}/issues`, { method: 'POST', ...auth, body }),
    onSuccess: () => {
      invalidateShiftQueries(queryClient, branchId);
      queryClient.invalidateQueries({ queryKey: ['shift'] });
    },
  });
}

export function useUpdateShiftIssueMutation(branchId: string, auth: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, ...body }: { issueId: string; status: 'resolved' | 'carried_over'; resolution?: string }) =>
      apiFetch<ShiftIssue>(`/shift-issues/${issueId}`, { method: 'PATCH', ...auth, body }),
    onSuccess: () => {
      invalidateShiftQueries(queryClient, branchId);
      queryClient.invalidateQueries({ queryKey: ['shift'] });
    },
  });
}
