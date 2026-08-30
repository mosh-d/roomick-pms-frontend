import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/** Mirrors `Brand` (roomick-pms-backend/prisma/schema.prisma). */
export interface Brand {
  id: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string | null;
  defaultPolicies: Record<string, unknown> | null;
}

/** Mirrors the full `Branch` row — `PropertyService.getBranch`'s own return shape, not the trimmed `{id, name}` `listBranches` uses. */
export interface BranchDetail {
  id: string;
  brandId: string;
  name: string;
  address: { street: string; city: string; state?: string; country: string; zip?: string };
  timezone: string;
  currency: string;
  checkInTime: string;
  checkOutTime: string;
  category: string | null;
  policies: Record<string, unknown> | null;
  noShowPolicy: { cutoffTime?: string; defaultPenalty?: string; autoMark?: boolean; notifyMinutesBefore?: number } | null;
  regCardTemplate: unknown;
}

/** `GET /brands` is Owner-only — pass `enabled: false` for a non-owner viewer so this never fires a request that can only 403. */
export function useBrandsQuery({ accessToken, tenantId }: AuthOpts, enabled = true) {
  return useQuery({
    queryKey: ['brands', tenantId ?? ''] as const,
    queryFn: () => apiFetch<Brand[]>('/brands', { accessToken, tenantId }),
    enabled: enabled && tenantId !== undefined,
  });
}

export function useUpdateBrandMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ brandId, ...body }: { brandId: string; name?: string; logoUrl?: string; primaryColor?: string }) =>
      apiFetch<Brand>(`/brands/${brandId}`, { method: 'PATCH', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brands'] }),
  });
}

function branchDetailQueryKey(branchId: string) {
  return ['branch-detail', branchId] as const;
}

/** `GET /branches/:branchId` — added specifically for this page (roomick-pms-backend PropertyService.getBranch). Owner+Manager, unlike the trimmed Owner-only `GET /branches` list. */
export function useBranchDetailQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: branchDetailQueryKey(branchId ?? ''),
    queryFn: () => apiFetch<BranchDetail>(`/branches/${branchId}`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

interface UpdateBranchInput {
  name?: string;
  address?: { street: string; city: string; state?: string; country: string; zip?: string };
  timezone?: string;
  currency?: string;
  checkInTime?: string;
  checkOutTime?: string;
  category?: string;
}

export function useUpdateBranchMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateBranchInput) => apiFetch<BranchDetail>(`/branches/${branchId}`, { method: 'PATCH', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: branchDetailQueryKey(branchId) }),
  });
}

export function useSetNoShowPolicyMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { cutoffTime?: string; defaultPenalty?: string; autoMark?: boolean; notifyMinutesBefore?: number }) =>
      apiFetch<BranchDetail>(`/branches/${branchId}/policies/no-show`, { method: 'PATCH', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: branchDetailQueryKey(branchId) }),
  });
}
