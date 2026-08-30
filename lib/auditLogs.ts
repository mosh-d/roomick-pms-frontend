import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';

/** Mirrors `AuditLogRow` (roomick-pms-backend/src/modules/audit-logs/audit-logs.service.ts). `id` is already stringified server-side (source column is a BigInt). */
export interface AuditLogRow {
  id: string;
  tenantId: string;
  branchId: string | null;
  userId: string | null;
  action: string;
  entityType: string | null;
  entityId: string | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  timestamp: string;
  user: { id: string; name: string; email: string } | null;
}

export interface AuditLogFilter {
  branchId?: string;
  userId?: string;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

export function useAuditLogsQuery(filter: AuditLogFilter, { accessToken, tenantId }: AuthOpts) {
  const params = new URLSearchParams();
  if (filter.branchId) params.set('branchId', filter.branchId);
  if (filter.userId) params.set('userId', filter.userId);
  if (filter.action) params.set('action', filter.action);
  if (filter.from) params.set('from', filter.from);
  if (filter.to) params.set('to', filter.to);
  params.set('page', String(filter.page ?? 1));
  params.set('limit', String(filter.limit ?? 50));

  return useQuery({
    queryKey: ['audit-logs', filter] as const,
    queryFn: () => apiFetch<{ rows: AuditLogRow[]; total: number; page: number; limit: number }>(`/audit-logs?${params.toString()}`, { accessToken, tenantId }),
    enabled: tenantId !== undefined,
  });
}
