import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

export type RateType = 'base' | 'seasonal' | 'weekend' | 'corporate' | 'negotiated' | 'promotional';
export type AdjustmentType = 'fixed' | 'percentage';

/** Mirrors `RateResolverService`'s `StayResolution` (roomick-pms-backend/src/modules/rate-resolver/rate-resolver.service.ts). */
export interface RateQuote {
  nightlyRate: string;
  subtotal: string;
  taxTotal: string;
  totalWithTax: string;
  ratePlanId: string | null;
  ruleApplied: { type: 'override' | 'cascade' | 'base'; planName: string | null; adjustmentApplied: string | null };
  perNight: Array<{ date: string; finalRate: string; isOverride: boolean; ratePlanId: string | null }>;
}

export interface RatePlan {
  id: string;
  roomTypeId: string | null;
  name: string;
  type: RateType;
  amount: string;
  adjustmentType: AdjustmentType | null;
  cascadeTier: number;
  isOverride: boolean;
  validFrom: string | null;
  validTo: string | null;
  minLOS: number | null;
  promoCode: string | null;
  isActive: boolean;
}

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/**
 * "Never caches locally" (ref: Rate Resolver Service) — `staleTime: 0` so
 * a re-render with the same dependency values still asks the server again
 * rather than trusting a client-held copy of a price. Every call also
 * writes a `RateAuditLog` row server-side (by design — see the backend's
 * own comment on `resolveStay`), so this only fires once dependencies are
 * actually complete, not on every keystroke of an in-progress form.
 */
export function useCalculateRateQuery(
  branchId: string | null,
  params: { roomTypeId: string | null; checkInDate: string | null; checkOutDate: string | null; promoCode?: string; corporateAccountId?: string },
  { accessToken, tenantId }: AuthOpts,
) {
  const ready = Boolean(branchId && params.roomTypeId && params.checkInDate && params.checkOutDate && params.checkOutDate > params.checkInDate);
  return useQuery({
    queryKey: ['rate-quote', branchId, params.roomTypeId, params.checkInDate, params.checkOutDate, params.promoCode ?? null, params.corporateAccountId ?? null] as const,
    queryFn: () =>
      apiFetch<RateQuote>(`/branches/${branchId}/rate-resolver/calculate`, {
        method: 'POST',
        accessToken,
        tenantId,
        body: {
          roomTypeId: params.roomTypeId,
          checkInDate: params.checkInDate,
          checkOutDate: params.checkOutDate,
          promoCode: params.promoCode || undefined,
          corporateAccountId: params.corporateAccountId || undefined,
        },
      }),
    enabled: ready,
    staleTime: 0,
  });
}

export function ratePlansQueryKey(branchId: string) {
  return ['rate-plans', branchId] as const;
}

export function useRatePlansQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ratePlansQueryKey(branchId ?? ''),
    queryFn: () => apiFetch<RatePlan[]>(`/branches/${branchId}/rate-plans`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useCreateRatePlanMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      roomTypeId?: string;
      name: string;
      type: RateType;
      amount: number;
      adjustmentType?: AdjustmentType;
      validFrom?: string;
      validTo?: string;
      minLOS?: number;
      promoCode?: string;
    }) => apiFetch<RatePlan>(`/branches/${branchId}/rate-plans`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ratePlansQueryKey(branchId) }),
  });
}

export function useUpdateRatePlanMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ratePlanId, isActive }: { ratePlanId: string; isActive: boolean }) =>
      apiFetch<RatePlan>(`/rate-plans/${ratePlanId}`, { method: 'PATCH', accessToken, tenantId, body: { isActive } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ratePlansQueryKey(branchId) }),
  });
}
