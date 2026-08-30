import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/** Mirrors `TenantFeatureFlag` (roomick-pms-backend/src/modules/feature-flags/feature-flags.service.ts). The raw `enabledForTenants` array is never sent to the client — only this tenant's own resolved status. */
export interface TenantFeatureFlag {
  id: string;
  name: string;
  enabledForThisTenant: boolean;
  rolloutPct: number | null;
  updatedAt: string;
}

const FEATURE_FLAGS_KEY = ['feature-flags'] as const;

export function useFeatureFlagsQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: FEATURE_FLAGS_KEY,
    queryFn: () => apiFetch<TenantFeatureFlag[]>('/feature-flags', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
  });
}

export function useToggleFeatureFlagMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ flagId, enabled }: { flagId: string; enabled: boolean }) =>
      apiFetch<TenantFeatureFlag>(`/feature-flags/${flagId}/toggle-for-tenant`, { method: 'PATCH', accessToken, tenantId, body: { enabled } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: FEATURE_FLAGS_KEY }),
  });
}

/** Mirrors `BackupRecordSummary` (roomick-pms-backend/src/modules/backups/backups.service.ts). `sizeBytes` is already stringified server-side (source column is a BigInt). */
export interface BackupRecordSummary {
  id: string;
  type: string;
  status: string;
  sizeBytes: string | null;
  startedAt: string;
  completedAt: string | null;
  retainUntil: string | null;
}

export interface VerifyBackupResult {
  ok: boolean;
  modelCounts?: Record<string, number>;
  error?: string;
}

export interface RestoreDrillResult {
  ok: boolean;
  modelCounts?: Record<string, { expected: number; restored: number }>;
  mismatches?: string[];
  error?: string;
}

const BACKUPS_KEY = ['backups'] as const;

export function useBackupsQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: BACKUPS_KEY,
    queryFn: () => apiFetch<BackupRecordSummary[]>('/backups', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
  });
}

export function useTriggerBackupMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<{ id: string; status: string; sizeBytes?: number }>('/backups', { method: 'POST', accessToken, tenantId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BACKUPS_KEY }),
  });
}

export function useVerifyBackupMutation({ accessToken, tenantId }: AuthOpts) {
  return useMutation({
    mutationFn: (backupId: string) => apiFetch<VerifyBackupResult>(`/backups/${backupId}/verify`, { method: 'POST', accessToken, tenantId }),
  });
}

export function useRestoreDrillMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (backupId: string) => apiFetch<RestoreDrillResult>(`/backups/${backupId}/restore-drill`, { method: 'POST', accessToken, tenantId }),
    // A restore drill creates + deletes its own throwaway tenant — never
    // touches this tenant's own backup rows — but re-fetching keeps the
    // list's own "last verified" affordance honest if it's added later.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: BACKUPS_KEY }),
  });
}

/** Mirrors `DetailedHealthReport` (roomick-pms-backend/src/modules/system/system.service.ts). */
export interface DetailedHealthReport {
  status: 'ok' | 'degraded';
  timestamp: string;
  checks: { database: 'up' | 'down'; databaseLatencyMs: number };
  process: { uptimeSeconds: number; memory: { rssMb: number; heapUsedMb: number; heapTotalMb: number } };
  requestMetrics: { windowMinutes: number; requestCount: number; errorCount: number; avgResponseTimeMs: number | null; errorRatePct: number | null };
}

export function useDetailedHealthQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['system-health-detailed'] as const,
    queryFn: () => apiFetch<DetailedHealthReport>('/system/health/detailed', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
    // Live-ish without hammering the server — this is a monitoring page, not a form.
    refetchInterval: 30_000,
  });
}
