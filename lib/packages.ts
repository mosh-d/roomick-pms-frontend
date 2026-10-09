import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

export type PackageBasis = 'per_night' | 'per_stay' | 'per_person_per_night';
export type PackageChargeType = 'fnb' | 'spa' | 'laundry' | 'minibar' | 'transport' | 'misc';

/** Mirrors `PackageView` (roomick-pms-backend/src/modules/rate-resolver/packages.service.ts). */
export interface StayPackage {
  id: string;
  name: string;
  description: string | null;
  price: string;
  basis: PackageBasis;
  chargeType: PackageChargeType;
  /** The room types it comes with; empty = all. */
  roomTypeIds: string[];
  showOnline: boolean;
  isActive: boolean;
  sortOrder: number | null;
}

/** A package as a stay holds it — priced when it was added. */
export interface PackageSnapshot {
  packageId: string;
  name: string;
  price: string;
  basis: PackageBasis;
  chargeType: PackageChargeType;
}

export const BASIS_LABELS: Record<PackageBasis, string> = {
  per_night: 'a night',
  per_stay: 'for the stay',
  per_person_per_night: 'a guest, a night',
};

export const PACKAGE_CHARGE_LABELS: Record<PackageChargeType, string> = {
  fnb: 'Food & Drink',
  spa: 'Spa',
  laundry: 'Laundry',
  minibar: 'Minibar',
  transport: 'Transport',
  misc: 'Other',
};

/** What a package comes to for a stay — the same arithmetic the bill posts. */
export function packageTotal(pkg: Pick<StayPackage, 'price' | 'basis'>, nights: number, guests: number): number {
  const price = Number(pkg.price);
  if (pkg.basis === 'per_stay') return price;
  return price * Math.max(0, nights) * (pkg.basis === 'per_person_per_night' ? Math.max(1, guests) : 1);
}

function key(branchId: string) {
  return ['packages', branchId] as const;
}

export function usePackagesQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: key(branchId ?? ''),
    queryFn: () => apiFetch<StayPackage[]>(`/branches/${branchId}/packages`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export type PackageInput = {
  name: string;
  description?: string;
  price: number;
  basis: PackageBasis;
  chargeType: PackageChargeType;
  roomTypeIds?: string[];
  showOnline?: boolean;
};

export function useSavePackageMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ packageId, body }: { packageId: string | null; body: Partial<PackageInput> & { isActive?: boolean } }) =>
      packageId
        ? apiFetch<StayPackage>(`/packages/${packageId}`, { method: 'PATCH', accessToken, tenantId, body })
        : apiFetch<StayPackage>(`/branches/${branchId}/packages`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(branchId) }),
  });
}

export function useRemovePackageMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (packageId: string) => apiFetch(`/packages/${packageId}`, { method: 'DELETE', accessToken, tenantId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key(branchId) }),
  });
}

/** Sets a stay's packages — these, and only these, from now on. */
export function useSetStayPackagesMutation(reservationId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (packageIds: string[]) => apiFetch(`/reservations/${reservationId}/packages`, { method: 'PUT', accessToken, tenantId, body: { packageIds } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['reservation', reservationId] });
    },
  });
}
