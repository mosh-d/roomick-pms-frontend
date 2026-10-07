import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, downloadFile } from './api';

export type GdprType = 'access' | 'erasure' | 'portability';
export type GdprStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';

/** Mirrors `GdprRequest` (roomick-pms-backend/prisma/schema.prisma). */
export interface GdprRequestRow {
  id: string;
  guestId: string;
  type: GdprType;
  status: GdprStatus;
  requestedBy: string;
  requestedAt: string;
  deadline: string;
  completedAt: string | null;
  exportUrl: string | null;
  notes: string | null;
  guest: { id: string; name: string; email: string | null };
}

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

export function useGdprRequestsQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['gdpr-requests', tenantId ?? ''] as const,
    queryFn: () => apiFetch<GdprRequestRow[]>('/gdpr/data-requests', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
  });
}

export function useCreateGdprRequestMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { guestId: string; type: GdprType; requestedBy: string; verificationMethod?: string }) =>
      apiFetch<GdprRequestRow>('/gdpr/data-requests', { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gdpr-requests'] }),
  });
}

export function useUpdateGdprStatusMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ requestId, ...body }: { requestId: string; status: 'in_progress' | 'completed' | 'rejected'; notes?: string }) =>
      apiFetch<GdprRequestRow>(`/gdpr/data-requests/${requestId}/status`, { method: 'PATCH', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['gdpr-requests'] }),
  });
}

/** Carries out an erasure request — see `GdprService.eraseGuestData`: identity gone, financial record kept. The guest lists and profiles change too. */
export function useEraseGuestMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => apiFetch<GdprRequestRow>(`/gdpr/data-requests/${requestId}/erase`, { method: 'POST', accessToken, tenantId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gdpr-requests'] });
      queryClient.invalidateQueries({ queryKey: ['guests-list'] });
      queryClient.invalidateQueries({ queryKey: ['guests-search'] });
    },
  });
}

/** Triggers a real browser download — same `downloadFile` mechanism report PDF exports already use, since this route needs the Authorization/X-Tenant-ID headers a plain `<a href>` can't carry. */
export function downloadGdprExport(requestId: string, auth: { accessToken?: string; tenantId?: string }) {
  return downloadFile(`/gdpr/data-requests/${requestId}/export`, `gdpr-export-${requestId}.json`, auth);
}

/** Mirrors `RetentionStatus` (roomick-pms-backend/src/modules/gdpr/retention.service.ts). */
export interface RetentionStatus {
  /** null = everything is kept (the default). */
  months: number | null;
  /** What's past that period now — removed at the next nightly run. */
  due: { registrationCards: number; idDocuments: number };
}

/** The setting as saved, or — with `months` — what that period would remove, without changing anything. */
export function useRetentionQuery({ accessToken, tenantId }: AuthOpts, months?: number) {
  return useQuery({
    queryKey: ['retention', tenantId ?? '', months ?? 'saved'] as const,
    queryFn: () => apiFetch<RetentionStatus>(`/gdpr/retention${months === undefined ? '' : `?months=${months}`}`, { accessToken, tenantId }),
    enabled: tenantId !== undefined,
  });
}

export function useSetRetentionMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (months: number | null) => apiFetch<RetentionStatus>('/gdpr/retention', { method: 'PUT', accessToken, tenantId, body: { months } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['retention'] }),
  });
}

/** Removes what's past the period now, instead of waiting for the night. */
export function useRunRetentionMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ registrationCards: number; idDocuments: number; filesDeleted: number }>('/gdpr/retention/run', { method: 'POST', accessToken, tenantId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['retention'] }),
  });
}
