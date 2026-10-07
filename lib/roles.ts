import type { AuthUser } from './store/authStore';

/**
 * Client mirror of `roomick-pms-backend/src/modules/property/rooms.service.ts`'s
 * `SUPERVISOR_ROLES = new Set(['owner', 'manager'])` — same accepted,
 * documented drift risk as `lib/api.ts`'s `ApiErrorCode` mirroring backend
 * error codes (no shared-types package between the two repos yet).
 *
 * **UX only, not enforcement.** This decides which status-change buttons a
 * `RoomDetailPanel` even shows — the backend's own `changeStatus` is the
 * real authority (already tested in `rooms.service.spec.ts`'s
 * `ForbiddenException` cases) and rejects an unauthorized call regardless
 * of what this function says. Never treat a `true` here as a security
 * guarantee.
 */
export function isSupervisorAtBranch(user: AuthUser | null, branchId: string): boolean {
  if (!user) return false;
  return user.roles.some(
    (r) => (r.role === 'owner' || r.role === 'manager') && (r.branchId === null || r.branchId === branchId),
  );
}

const SEEDED_ROLES = new Set(['owner', 'manager', 'front_desk', 'housekeeper', 'accountant', 'pos_staff']);

/**
 * Holds one of `roles` at this branch. A custom role (a name the app didn't
 * seed) counts as yes: its permissions live on the server, which decides.
 * Same UX-only caveat as `isSupervisorAtBranch`.
 */
export function mayActAtBranch(user: AuthUser | null, branchId: string, roles: readonly string[]): boolean {
  if (!user) return false;
  return user.roles.some((r) => (r.branchId === null || r.branchId === branchId) && (roles.includes(r.role) || !SEEDED_ROLES.has(r.role)));
}

/** Brand-level settings (`PATCH /brands/:brandId`) are Owner-only, tenant-wide — no branch to scope against. Same UX-only caveat as `isSupervisorAtBranch`. */
export function isOwner(user: AuthUser | null): boolean {
  if (!user) return false;
  return user.roles.some((r) => r.role === 'owner');
}
