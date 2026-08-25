import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';
import { getDistinctBranchIds } from './branches';
import type { AuthUser } from './store/authStore';

export type DashboardBranch = { id: string; name: string };

/**
 * Resolves which branch(es) `app/dashboard/layout.tsx` should offer —
 * two different backend endpoints depending on how the signed-in account
 * holds its roles:
 *
 * - Staff with an explicit per-branch role (`branchId` set on at least one
 *   role row) → `GET /auth/me/branches` (already used by the login-time
 *   `BranchPicker`).
 * - An owner's own role is always `branchId: null` ("all branches"), which
 *   `getDistinctBranchIds` correctly filters out as "not a pickable one" —
 *   `GET /auth/me/branches` always returns `[]` for them by design (see
 *   its own passing test). Owners instead resolve via the separate
 *   owner-only `GET /branches`.
 */
export function useMyBranches(
  user: AuthUser | null,
  { accessToken, tenantId }: { accessToken: string | undefined; tenantId: string | undefined },
) {
  const hasExplicitBranchRoles = user ? getDistinctBranchIds(user.roles).length > 0 : false;
  const path = hasExplicitBranchRoles ? '/auth/me/branches' : '/branches';

  return useQuery({
    queryKey: ['dashboard-branches', tenantId, path],
    queryFn: () => apiFetch<DashboardBranch[]>(path, { accessToken, tenantId }),
    enabled: !!user,
  });
}
