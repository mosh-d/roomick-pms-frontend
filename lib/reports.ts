import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';

export type ReportGroupBy = 'day' | 'week' | 'month';

export interface OccupancyReport {
  from: string;
  to: string;
  groupBy: ReportGroupBy;
  summary: { roomNightsAvailable: number; roomNightsSold: number; occupancyPct: number };
  byRoomType: Array<{ roomTypeId: string; roomTypeName: string; roomNightsAvailable: number; roomNightsSold: number; occupancyPct: number }>;
  trend: Array<{ period: string; roomNightsAvailable: number; roomNightsSold: number; occupancyPct: number }>;
}

export interface AdrReport {
  from: string;
  to: string;
  currency: string;
  summary: { roomNightsSold: number; roomRevenue: string; adr: string };
  byRoomType: Array<{ roomTypeId: string; roomTypeName: string; roomNightsSold: number; roomRevenue: string; adr: string }>;
  trend: Array<{ period: string; roomNightsSold: number; roomRevenue: string; adr: string }>;
}

export interface RevparReport {
  from: string;
  to: string;
  currency: string;
  summary: { roomNightsAvailable: number; roomRevenue: string; revpar: string };
  byRoomType: Array<{ roomTypeId: string; roomTypeName: string; roomNightsAvailable: number; roomRevenue: string; revpar: string }>;
  trend: Array<{ period: string; roomNightsAvailable: number; roomRevenue: string; revpar: string }>;
}

export interface RevenueReport {
  from: string;
  to: string;
  currency: string;
  summary: { totalRevenue: string };
  byDepartment: Array<{ chargeType: string; amount: string }>;
  byPaymentMethod: Array<{ method: string; amount: string }>;
  trend: Array<{ period: string; amount: string }>;
}

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };
type ReportParams = { from: string; to: string; groupBy?: ReportGroupBy; roomTypeId?: string };

function reportQueryString(params: ReportParams): string {
  const qs = new URLSearchParams({ from: params.from, to: params.to });
  if (params.groupBy) qs.set('groupBy', params.groupBy);
  if (params.roomTypeId) qs.set('roomTypeId', params.roomTypeId);
  return qs.toString();
}

export function useOccupancyReportQuery(branchId: string | null, params: ReportParams, auth: AuthOpts) {
  return useQuery({
    queryKey: ['reports', 'occupancy', branchId, params] as const,
    queryFn: () => apiFetch<OccupancyReport>(`/branches/${branchId}/reports/occupancy?${reportQueryString(params)}`, auth),
    enabled: branchId !== null,
  });
}

export function useAdrReportQuery(branchId: string | null, params: ReportParams, auth: AuthOpts) {
  return useQuery({
    queryKey: ['reports', 'adr', branchId, params] as const,
    queryFn: () => apiFetch<AdrReport>(`/branches/${branchId}/reports/adr?${reportQueryString(params)}`, auth),
    enabled: branchId !== null,
  });
}

export function useRevparReportQuery(branchId: string | null, params: ReportParams, auth: AuthOpts) {
  return useQuery({
    queryKey: ['reports', 'revpar', branchId, params] as const,
    queryFn: () => apiFetch<RevparReport>(`/branches/${branchId}/reports/revpar?${reportQueryString(params)}`, auth),
    enabled: branchId !== null,
  });
}

export function useRevenueReportQuery(branchId: string | null, params: ReportParams, auth: AuthOpts) {
  return useQuery({
    queryKey: ['reports', 'revenue', branchId, params] as const,
    queryFn: () => apiFetch<RevenueReport>(`/branches/${branchId}/reports/revenue?${reportQueryString(params)}`, auth),
    enabled: branchId !== null,
  });
}

export type ReportType = 'occupancy' | 'adr' | 'revpar' | 'revenue';

/** Path for `downloadFile` — mirrors this file's own query-hook URLs exactly, just `/pdf` appended (`ReportsController`'s own routes). */
export function reportPdfPath(branchId: string, type: ReportType, params: ReportParams): string {
  return `/branches/${branchId}/reports/${type}/pdf?${reportQueryString(params)}`;
}
