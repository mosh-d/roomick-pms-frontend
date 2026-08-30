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
  guest: { id: string; name: string; email: string };
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

/** Triggers a real browser download — same `downloadFile` mechanism report PDF exports already use, since this route needs the Authorization/X-Tenant-ID headers a plain `<a href>` can't carry. */
export function downloadGdprExport(requestId: string, auth: { accessToken?: string; tenantId?: string }) {
  return downloadFile(`/gdpr/data-requests/${requestId}/export`, `gdpr-export-${requestId}.json`, auth);
}
