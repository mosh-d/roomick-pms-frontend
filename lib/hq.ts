import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/** Mirrors `PortfolioOverview`/`PortfolioBranchSummary` (roomick-pms-backend/src/modules/hq/hq.service.ts). A live snapshot, not a date-ranged report. */
export interface PortfolioBranchSummary {
  branchId: string;
  branchName: string;
  brandId: string;
  brandName: string;
  currency: string;
  totalRooms: number;
  occupiedRooms: number;
  occupancyPctNow: number;
  inHouseReservations: number;
  outstandingBalance: string;
}

export interface PortfolioOverview {
  brandCount: number;
  branchCount: number;
  branches: PortfolioBranchSummary[];
}

export function usePortfolioQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['hq-portfolio'] as const,
    queryFn: () => apiFetch<PortfolioOverview>('/hq/portfolio', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
  });
}

export type CrossPropertyReportType = 'occupancy' | 'adr' | 'revpar' | 'revenue';

/** Mirrors `CrossPropertyReport` — `summary`/`blendedTotal` shapes vary by `type`, matching each single-branch report's own summary shape exactly. */
export interface CrossPropertyReportRow {
  branchId: string;
  branchName: string;
  currency: string;
  summary: Record<string, string | number>;
}

export interface CrossPropertyReport {
  type: CrossPropertyReportType;
  from: string;
  to: string;
  mixedCurrencies: boolean;
  rows: CrossPropertyReportRow[];
  blendedTotal: Record<string, string | number> | null;
}

export function useCrossPropertyReportQuery(
  params: { type: CrossPropertyReportType; from: string; to: string; branchIds?: string[] },
  { accessToken, tenantId }: AuthOpts,
) {
  const query = new URLSearchParams({ type: params.type, from: params.from, to: params.to });
  if (params.branchIds && params.branchIds.length > 0) query.set('branchIds', params.branchIds.join(','));

  return useQuery({
    queryKey: ['hq-cross-property-report', params] as const,
    queryFn: () => apiFetch<CrossPropertyReport>(`/hq/reports?${query.toString()}`, { accessToken, tenantId }),
    enabled: tenantId !== undefined,
  });
}
