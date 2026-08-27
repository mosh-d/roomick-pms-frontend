import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { reservationsQueryKey } from './reservations';

/** `passed: null` = the check can't be evaluated because its module isn't built — surfaced as "not tracked", never as a pass. */
export interface PreflightCheck {
  key: string;
  label: string;
  passed: boolean | null;
  detail: string | null;
}

export interface NightAuditPreflight {
  auditDate: string;
  alreadyRan: boolean;
  checklist: PreflightCheck[];
  openFolios: { id: string; guestName: string }[];
  unresolvedNoShows: { id: string; confirmationNumber: string; guestName: string; checkInDate: string }[];
}

export interface NightAuditRun {
  id: string;
  auditDate: string;
  triggeredBy: string | null;
  triggeredAt: string;
  status: 'running' | 'completed' | 'failed';
  foliosProcessed: number | null;
  chargesPosted: number | null;
  totalAmountPosted: string | null;
  errors: { reservationId: string; reason: string }[] | null;
  completedAt: string | null;
  currency: string;
}

export interface NightAuditRunResult {
  auditDate: string;
  foliosProcessed: number;
  chargesPosted: number;
  totalAmountPosted: string;
  noShowsMarked: number;
  errors: { reservationId: string; reason: string }[];
  status: 'completed' | 'failed';
}

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

export function useNightAuditPreflightQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['night-audit-preflight', branchId] as const,
    queryFn: () => apiFetch<NightAuditPreflight>(`/branches/${branchId}/night-audit/preflight`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useNightAuditRunsQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['night-audit-runs', branchId] as const,
    queryFn: () => apiFetch<NightAuditRun[]>(`/branches/${branchId}/night-audit`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

/** A run posts charges and can flip reservations to no-show, so it invalidates folios, the in-house list, and arrivals alongside its own queries. */
export function useRunNightAuditMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (auditDate?: string) =>
      apiFetch<NightAuditRunResult>(`/branches/${branchId}/night-audit/run`, {
        method: 'POST',
        accessToken,
        tenantId,
        body: auditDate ? { auditDate } : {},
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['night-audit-preflight', branchId] });
      queryClient.invalidateQueries({ queryKey: ['night-audit-runs', branchId] });
      queryClient.invalidateQueries({ queryKey: ['folios', branchId] });
      queryClient.invalidateQueries({ queryKey: reservationsQueryKey('inHouse', branchId) });
      queryClient.invalidateQueries({ queryKey: ['reservations', 'arrivals', branchId] });
    },
  });
}
