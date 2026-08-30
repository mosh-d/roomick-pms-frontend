import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/** Mirrors `LoyaltySummary` (roomick-pms-backend/src/modules/loyalty/loyalty.service.ts). Display-only — no earn/redeem logic exists anywhere behind this. */
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

export function useLoyaltySummaryQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['loyalty-summary'] as const,
    queryFn: () => apiFetch<LoyaltySummary>('/loyalty/summary', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
  });
}
