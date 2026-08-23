/** Distinct, non-null branch ids from a JWT's `roles` claim — `branchId: null` means "all branches" (owner), not a pickable one. */
export function getDistinctBranchIds(roles: Array<{ branchId: string | null; role: string }>): string[] {
  return [...new Set(roles.map((r) => r.branchId).filter((id): id is string => id !== null))];
}
