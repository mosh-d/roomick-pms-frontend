import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/** Mirrors `AvailabilityRestrictionSummary` (roomick-pms-backend/src/modules/revenue-management/restrictions.service.ts). */
export interface AvailabilityRestrictionSummary {
  id: string;
  roomTypeId: string | null;
  roomTypeName: string | null;
  startDate: string;
  endDate: string;
  minLOS: number | null;
  maxLOS: number | null;
  closedToArrival: boolean;
  stopSell: boolean;
  createdAt: string;
}

/** Mirrors `ForecastDay`. `forecastOccupancyPct: null` = no historical data yet — a real, honest gap, never a fabricated number. */
export interface ForecastDay {
  date: string;
  dayOfWeek: string;
  forecastOccupancyPct: number | null;
  historicalSampleSize: number;
}

/** Mirrors `RateRecommendation`. Fixed-threshold, rule-based — never labeled "AI" anywhere in this app. */
export interface RateRecommendation {
  date: string;
  dayOfWeek: string;
  forecastOccupancyPct: number | null;
  currentBaseRate: string;
  suggestedAdjustmentPct: number;
  suggestedRate: string;
  rationale: string;
}

function restrictionsQueryKey(branchId: string) {
  return ['availability-restrictions', branchId] as const;
}

export function useAvailabilityRestrictionsQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: restrictionsQueryKey(branchId ?? ''),
    queryFn: () => apiFetch<AvailabilityRestrictionSummary[]>(`/branches/${branchId}/availability-restrictions`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useCreateAvailabilityRestrictionMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { roomTypeId?: string; startDate: string; endDate: string; minLOS?: number; maxLOS?: number; closedToArrival?: boolean; stopSell?: boolean }) =>
      apiFetch<AvailabilityRestrictionSummary>(`/branches/${branchId}/availability-restrictions`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: restrictionsQueryKey(branchId) }),
  });
}

export function useDeleteAvailabilityRestrictionMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (restrictionId: string) => apiFetch<{ ok: true }>(`/availability-restrictions/${restrictionId}`, { method: 'DELETE', accessToken, tenantId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: restrictionsQueryKey(branchId) }),
  });
}

function demandForecastQueryKey(branchId: string, horizonDays: number) {
  return ['demand-forecast', branchId, horizonDays] as const;
}

export function useDemandForecastQuery(branchId: string | null, horizonDays: number, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: demandForecastQueryKey(branchId ?? '', horizonDays),
    queryFn: () => apiFetch<ForecastDay[]>(`/branches/${branchId}/demand-forecast?horizonDays=${horizonDays}`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

function rateRecommendationsQueryKey(branchId: string, roomTypeId: string) {
  return ['rate-recommendations', branchId, roomTypeId] as const;
}

export function useRateRecommendationsQuery(branchId: string | null, roomTypeId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: rateRecommendationsQueryKey(branchId ?? '', roomTypeId ?? ''),
    queryFn: () => apiFetch<RateRecommendation[]>(`/branches/${branchId}/rate-recommendations?roomTypeId=${roomTypeId}`, { accessToken, tenantId }),
    enabled: branchId !== null && roomTypeId !== null,
  });
}

export function useApproveRateRecommendationMutation(branchId: string, roomTypeId: string | null, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { roomTypeId: string; date: string; adjustmentPct: number }) =>
      apiFetch<{ id: string }>(`/branches/${branchId}/rate-recommendations/approve`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rateRecommendationsQueryKey(branchId, roomTypeId ?? '') }),
  });
}
