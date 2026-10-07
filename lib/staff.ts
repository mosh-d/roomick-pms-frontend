import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

/** Mirrors `Role` (roomick-pms-backend/prisma/schema.prisma) — `permissions` isn't read here yet (Security & Roles' own future page owns that editor). */
export interface Role {
  id: string;
  name: string;
  /** True for the six built-in roles: their access is fixed by the routes, not by this map. */
  isSystem: boolean;
  permissions: Record<string, string[]> | null;
}

/** Mirrors `AuthService.permissionCatalogue` — what a custom role can be given, and what each built-in role really covers. */
export interface PermissionCatalogue {
  modules: Array<{ key: string; label: string; description: string }>;
  actions: string[];
  systemRolePresets: Record<string, Record<string, string[]>>;
  /** Areas no custom role can be given, named so the matrix can say so. */
  undelegatable: string[];
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
  /** Two-step sign-in is on — an owner can reset it here if their phone and recovery codes are lost. */
  mfaEnabled: boolean;
  roles: Array<{ branchId: string | null; role: string; roleId: string }>;
  outletIds: string[];
  /** Whether you may change this person's role at this branch. */
  canChangeRole: boolean;
  /** Whether you may deactivate or reactivate their account, or make them a password-reset link. */
  canManageAccount: boolean;
}

export interface InviteResult {
  email: string;
  inviteId: string;
  publicToken: string;
  /** The page that accepts it — emailed when email is set up, and always here to hand over. */
  link: string;
  /** The invitation reached the person's inbox. */
  emailed: boolean;
  expiresAt: string;
}

/** Mirrors `PendingInvite` (roomick-pms-backend/src/modules/users/users.service.ts). */
export interface PendingInvite {
  id: string;
  email: string;
  roleId: string;
  role: string;
  invitedBy: string | null;
  createdAt: string;
  expiresAt: string;
  expired: boolean;
  /** Null for an invitation you couldn't have made yourself — a manager never sees the link to a manager's invitation. */
  link: string | null;
}

/**
 * Which roles you can hand out — the server's rule: nobody makes anyone an
 * owner, and only the owner makes someone a manager.
 */
export function grantableRoles(roles: Role[], youAreOwner: boolean): Role[] {
  return roles.filter((role) => role.name !== 'owner' && (youAreOwner || role.name !== 'manager'));
}

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

export function useRolesQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['roles', tenantId ?? ''] as const,
    queryFn: () => apiFetch<Role[]>('/auth/roles', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
  });
}

export function usePermissionCatalogueQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['permission-catalogue'] as const,
    queryFn: () => apiFetch<PermissionCatalogue>('/auth/permissions/catalogue', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
    staleTime: Infinity,
  });
}

export function useCreateRoleMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; permissions?: Record<string, string[]> }) => apiFetch<Role>('/auth/roles', { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles', tenantId ?? ''] }),
  });
}

export function useUpdateRoleMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, ...body }: { roleId: string; name?: string; permissions?: Record<string, string[]> }) =>
      apiFetch<Role>(`/auth/roles/${roleId}`, { method: 'PATCH', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles', tenantId ?? ''] }),
  });
}

export function useDeleteRoleMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (roleId: string) => apiFetch<{ deleted: true }>(`/auth/roles/${roleId}`, { method: 'DELETE', accessToken, tenantId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles', tenantId ?? ''] }),
  });
}

/** Only a custom role can be re-scoped; the API refuses a built-in one. */
export function useUpdateRolePermissionsMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roleId, permissions }: { roleId: string; permissions: Record<string, string[]> }) =>
      apiFetch<Role>(`/auth/roles/${roleId}/permissions`, { method: 'PUT', accessToken, tenantId, body: { permissions } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles', tenantId ?? ''] }),
  });
}

export function useStaffQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['staff', branchId ?? ''] as const,
    queryFn: () => apiFetch<StaffMember[]>(`/branches/${branchId}/staff`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

/** Re-inviting the same email and role sends a new invitation in place of the old one — which is also how one is sent again. */
export function useBulkInviteMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invites: Array<{ email: string; roleId: string }>) =>
      apiFetch<InviteResult[]>(`/branches/${branchId}/staff/invite`, { method: 'POST', accessToken, tenantId, body: { invites } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['staff', branchId] });
      void queryClient.invalidateQueries({ queryKey: ['staff-invites', branchId] });
    },
  });
}

export function useStaffInvitesQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['staff-invites', branchId ?? ''] as const,
    queryFn: () => apiFetch<PendingInvite[]>(`/branches/${branchId}/staff/invites`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useCancelInviteMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) => apiFetch<{ cancelled: true }>(`/staff-invites/${inviteId}`, { method: 'DELETE', accessToken, tenantId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['staff-invites', branchId] }),
  });
}

/** A one-use link for a colleague who's locked out: emailed to them when email is set up, and returned to hand over either way. */
export function usePasswordResetLinkMutation({ accessToken, tenantId }: AuthOpts) {
  return useMutation({
    mutationFn: (userId: string) =>
      apiFetch<{ link: string; emailed: boolean; expiresAt: string }>(`/staff/${userId}/password-reset-link`, { method: 'POST', accessToken, tenantId }),
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
