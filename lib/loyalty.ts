import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/** Mirrors `LOYALTY_BENEFITS` (roomick-pms-backend/src/modules/loyalty/loyalty-rules.ts). Shown for staff to honour — the system doesn't apply them itself. */
export const LOYALTY_BENEFITS = ['late_checkout', 'early_checkin', 'room_upgrade', 'welcome_drink', 'free_breakfast', 'lounge_access'] as const;
export type LoyaltyBenefit = (typeof LOYALTY_BENEFITS)[number];

export const BENEFIT_LABELS: Record<LoyaltyBenefit, string> = {
  late_checkout: 'Late check-out',
  early_checkin: 'Early check-in',
  room_upgrade: 'Room upgrade',
  welcome_drink: 'Welcome drink',
  free_breakfast: 'Free breakfast',
  lounge_access: 'Lounge access',
};

export function benefitLabel(benefit: string): string {
  return BENEFIT_LABELS[benefit as LoyaltyBenefit] ?? benefit.replace(/_/g, ' ');
}

/** Mirrors `LoyaltySummary` (loyalty.service.ts). */
export interface LoyaltyMember {
  id: string;
  name: string;
  email: string | null;
  loyaltyTier: string;
  loyaltyPoints: number;
}

export interface LoyaltyTierSummary {
  tier: string;
  memberCount: number;
  totalPoints: number;
}

export interface LoyaltySummary {
  members: LoyaltyMember[];
  byTier: LoyaltyTierSummary[];
  totalMembers: number;
  totalPointsIssued: number;
}

export interface LoyaltyTier {
  name: string;
  /** Lifetime points a member needs to reach it. */
  threshold: number;
  benefits: string[];
}

/** Mirrors `LoyaltyProgramView`. `configured: false` = never saved; the figures are only a suggestion. */
export interface LoyaltyProgram {
  configured: boolean;
  isActive: boolean;
  currency: string;
  /** Points per 1 unit of currency spent before tax. */
  pointsPerUnit: string;
  /** What one point is worth when redeemed. */
  pointValue: string;
  tiers: LoyaltyTier[];
  branchCurrencies: string[];
  updatedAt: string | null;
}

/** Mirrors `GuestLoyaltyView`. */
export interface GuestLoyalty {
  guestId: string;
  programActive: boolean;
  currency: string | null;
  pointValue: string | null;
  enrolledAt: string | null;
  balance: number;
  lifetimePoints: number;
  tier: LoyaltyTier | null;
  tierName: string | null;
  nextTier: { name: string; pointsToGo: number } | null;
  redeemableValue: string | null;
  transactions: Array<{ id: string; type: 'earn' | 'redeem' | 'adjust'; points: number; description: string; createdAt: string }>;
}

export interface RedemptionResult {
  paymentId: string;
  pointsRedeemed: number;
  amount: string;
  currency: string;
  balance: number;
}

export function useLoyaltySummaryQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['loyalty-summary'] as const,
    queryFn: () => apiFetch<LoyaltySummary>('/loyalty/summary', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
  });
}

export function useLoyaltyProgramQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['loyalty-program'] as const,
    queryFn: () => apiFetch<LoyaltyProgram>('/loyalty/program', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
  });
}

function invalidateLoyalty(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: ['loyalty-program'] });
  queryClient.invalidateQueries({ queryKey: ['loyalty-summary'] });
  queryClient.invalidateQueries({ queryKey: ['guest-loyalty'] });
  queryClient.invalidateQueries({ queryKey: ['guest-profile'] });
}

export function useSaveLoyaltyProgramMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { isActive: boolean; currency: string; pointsPerUnit: number; pointValue: number; tiers: LoyaltyTier[] }) =>
      apiFetch<LoyaltyProgram>('/loyalty/program', { method: 'PUT', accessToken, tenantId, body }),
    onSuccess: () => invalidateLoyalty(queryClient),
  });
}

export function useGuestLoyaltyQuery(guestId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['guest-loyalty', guestId ?? ''] as const,
    queryFn: () => apiFetch<GuestLoyalty>(`/guests/${guestId}/loyalty`, { accessToken, tenantId }),
    enabled: guestId !== null,
  });
}

export function useEnrollGuestMutation(guestId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<GuestLoyalty>(`/guests/${guestId}/loyalty/enroll`, { method: 'POST', accessToken, tenantId }),
    onSuccess: () => invalidateLoyalty(queryClient),
  });
}

export function useAdjustPointsMutation(guestId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { points: number; reason: string }) =>
      apiFetch<GuestLoyalty>(`/guests/${guestId}/loyalty/adjustments`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => invalidateLoyalty(queryClient),
  });
}

/** Pays part of a bill with the guest's points — the bill's totals and the guest's balance both re-read. */
export function useRedeemPointsMutation(folioId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (points: number) => apiFetch<RedemptionResult>(`/folios/${folioId}/loyalty-redemptions`, { method: 'POST', accessToken, tenantId, body: { points } }),
    onSuccess: () => {
      invalidateLoyalty(queryClient);
      queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('folio') });
    },
  });
}
