import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/** `GET /branches/:branchId/my-pages` — `restricted: false` for an owner or the branch's manager, who see everything. */
export interface MyPages {
  restricted: boolean;
  pages: string[];
}

/** Mirrors `RolePageAccess` (roomick-pms-backend/src/common/permissions/page-access.service.ts). */
export interface RolePageAccess {
  roleId: string;
  name: string;
  isSystem: boolean;
  customised: boolean;
  available: string[];
  viewOnly: string[];
  pages: string[];
}

export interface PageAccessMatrix {
  pages: Array<{ key: string; label: string; group: 'Operations' | 'Management' | 'Admin'; feature: string }>;
  managerOnly: string[];
  roles: RolePageAccess[];
}

const myPagesKey = (branchId: string) => ['my-pages', branchId] as const;
const matrixKey = (branchId: string) => ['page-access', branchId] as const;

export function useMyPagesQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: myPagesKey(branchId ?? ''),
    queryFn: () => apiFetch<MyPages>(`/branches/${branchId}/my-pages`, { accessToken, tenantId }),
    enabled: branchId !== null && tenantId !== undefined,
    // A manager's change reaches people already signed in within a minute, without a refresh.
    refetchInterval: 60_000,
  });
}

export function usePageAccessQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: matrixKey(branchId ?? ''),
    queryFn: () => apiFetch<PageAccessMatrix>(`/branches/${branchId}/page-access`, { accessToken, tenantId }),
    enabled: branchId !== null && tenantId !== undefined,
  });
}

export function useSetRolePagesMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, pages }: { roleId: string; pages: string[] }) =>
      apiFetch<RolePageAccess>(`/branches/${branchId}/page-access/${roleId}`, { method: 'PUT', accessToken, tenantId, body: { pages } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: matrixKey(branchId) }),
  });
}

export function useResetRolePagesMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => apiFetch<RolePageAccess>(`/branches/${branchId}/page-access/${roleId}`, { method: 'DELETE', accessToken, tenantId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: matrixKey(branchId) }),
  });
}
