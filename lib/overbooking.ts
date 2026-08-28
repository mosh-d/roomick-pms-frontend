import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import type { ReservationSummary } from './reservations';

/** Mirrors `OverbookingConfig` (roomick-pms-backend/prisma/schema.prisma). `roomTypeId: null` = the branch-wide row. */
export interface OverbookingConfig {
  id: string;
  roomTypeId: string | null;
  globalEnabled: boolean;
  maxOverbookPct: string | null;
  alertAtPct: string | null;
  validFrom: string | null;
  validTo: string | null;
}

export interface OverbookingExposureNight {
  date: string;
  physicalPool: number;
  netCapacity: number;
  ceilingCapacity: number;
  reservedCount: number;
  isOverbooked: boolean;
  isAlerting: boolean;
}

export interface OverbookingExposure {
  year: number;
  month: number;
  roomTypes: Array<{ roomTypeId: string; roomTypeName: string; nights: OverbookingExposureNight[] }>;
}

/** Mirrors `WalkRecord` (roomick-pms-backend/prisma/schema.prisma). */
export interface WalkRecord {
  id: string;
  reservationId: string;
  relocationProperty: string;
  transportProvided: boolean;
  transportCost: string | null;
  compensationOffered: string | null;
  approvedBy: string | null;
  walkedAt: string;
}

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

export function useOverbookingConfigsQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['overbooking-config', branchId] as const,
    queryFn: () => apiFetch<OverbookingConfig[]>(`/branches/${branchId}/overbooking-config`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useUpdateOverbookingConfigMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      roomTypeId?: string;
      globalEnabled?: boolean;
      maxOverbookPct?: number;
      alertAtPct?: number;
      validFrom?: string;
      validTo?: string;
    }) => apiFetch<OverbookingConfig>(`/branches/${branchId}/overbooking-config`, { method: 'PATCH', accessToken, tenantId, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overbooking-config', branchId] });
      queryClient.invalidateQueries({ queryKey: ['overbooking-exposure', branchId] });
    },
  });
}

export function useOverbookingExposureQuery(branchId: string | null, year: number, month: number, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['overbooking-exposure', branchId, year, month] as const,
    queryFn: () => apiFetch<OverbookingExposure>(`/branches/${branchId}/overbooking/exposure?year=${year}&month=${month}`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useWalkReservationMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      reservationId,
      ...body
    }: {
      reservationId: string;
      relocationProperty: string;
      transportProvided?: boolean;
      transportCost?: number;
      compensationOffered?: string;
    }) => apiFetch<{ reservation: ReservationSummary; walkRecord: WalkRecord; refundedTotal: string }>(`/reservations/${reservationId}/walk`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reservations'] });
      queryClient.invalidateQueries({ queryKey: ['overbooking-exposure', branchId] });
      queryClient.invalidateQueries({ queryKey: ['availability-calendar', branchId] });
    },
  });
}
