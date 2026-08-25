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
