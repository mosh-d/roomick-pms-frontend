import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/** Mirrors `MfaStatus` (roomick-pms-backend/src/modules/auth/mfa.service.ts). */
export interface MfaStatus {
  enabled: boolean;
  enabledAt: string | null;
  /** Setup started but not confirmed with a first code. */
  pendingSetup: boolean;
  recoveryCodesLeft: number;
}

export interface MfaSetup {
  /** Base32 — for typing into an app when the QR can't be scanned. Shown once. */
  secret: string;
  otpauthUri: string;
}

const STATUS_KEY = ['mfa-status'] as const;

export function useMfaStatusQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: STATUS_KEY,
    queryFn: () => apiFetch<MfaStatus>('/auth/mfa', { accessToken, tenantId }),
    enabled: tenantId !== undefined && accessToken !== undefined,
  });
}

export function useBeginMfaSetupMutation({ accessToken, tenantId }: AuthOpts) {
  return useMutation({
    mutationFn: () => apiFetch<MfaSetup>('/auth/mfa/setup', { method: 'POST', accessToken, tenantId }),
  });
}

export function useEnableMfaMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => apiFetch<{ recoveryCodes: string[]; status: MfaStatus }>('/auth/mfa/enable', { method: 'POST', accessToken, tenantId, body: { code } }),
    onSuccess: (result) => queryClient.setQueryData(STATUS_KEY, result.status),
  });
}

export function useDisableMfaMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { password: string; code: string }) => apiFetch<MfaStatus>('/auth/mfa/disable', { method: 'POST', accessToken, tenantId, body }),
    onSuccess: (status) => queryClient.setQueryData(STATUS_KEY, status),
  });
}

export function useRegenerateRecoveryCodesMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) => apiFetch<{ recoveryCodes: string[]; status: MfaStatus }>('/auth/mfa/recovery-codes', { method: 'POST', accessToken, tenantId, body: { code } }),
    onSuccess: (result) => queryClient.setQueryData(STATUS_KEY, result.status),
  });
}

/** Owner only: for a colleague whose phone and recovery codes are both gone. */
export function useResetStaffMfaMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => apiFetch<{ reset: true }>(`/auth/mfa/reset/${userId}`, { method: 'POST', accessToken, tenantId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff'] }),
  });
}
