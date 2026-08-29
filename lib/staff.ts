import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

/** Mirrors `Role` (roomick-pms-backend/prisma/schema.prisma) — `permissions` isn't read here yet (Security & Roles' own future page owns that editor). */
export interface Role {
  id: string;
  name: string;
  permissions: Record<string, string[]> | null;
}

/** Mirrors `StaffListEntry` (roomick-pms-backend/src/modules/users/users.service.ts). */
export interface StaffMember {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  emailVerified: boolean;
  lastLoginAt: string | null;
  active: boolean;
  roles: Array<{ branchId: string | null; role: string; roleId: string }>;
  outletIds: string[];
}

export interface InviteResult {
  email: string;
  inviteId: string;
  publicToken: string;
  expiresAt: string;
}

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

export function useRolesQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['roles', tenantId ?? ''] as const,
    queryFn: () => apiFetch<Role[]>('/auth/roles', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
  });
}

export function useStaffQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['staff', branchId ?? ''] as const,
    queryFn: () => apiFetch<StaffMember[]>(`/branches/${branchId}/staff`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useBulkInviteMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invites: Array<{ email: string; roleId: string }>) =>
      apiFetch<InviteResult[]>(`/branches/${branchId}/staff/invite`, { method: 'POST', accessToken, tenantId, body: { invites } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff', branchId] }),
  });
}

export function usePatchStaffMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, ...body }: { userId: string; roleId?: string; branchId?: string; active?: boolean }) =>
      apiFetch<StaffMember>(`/staff/${userId}`, { method: 'PATCH', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff', branchId] }),
  });
}
