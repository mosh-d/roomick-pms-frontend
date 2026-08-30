import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/** Mirrors `GroupBlockSummary` (roomick-pms-backend/src/modules/sales-events/group-blocks.service.ts). `pickup` is always computed live from real reservations, never a stored counter. */
export interface GroupBlockSummary {
  id: string;
  name: string;
  roomTypeId: string;
  roomTypeName: string;
  blockSize: number;
  blockRate: string;
  cutoffDate: string;
  status: string;
  pickup: number;
  createdAt: string;
}

function groupBlocksQueryKey(branchId: string) {
  return ['group-blocks', branchId] as const;
}

export function useGroupBlocksQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: groupBlocksQueryKey(branchId ?? ''),
    queryFn: () => apiFetch<GroupBlockSummary[]>(`/branches/${branchId}/group-blocks`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useCreateGroupBlockMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; roomTypeId: string; blockSize: number; blockRate: number; cutoffDate: string }) =>
      apiFetch<GroupBlockSummary>(`/branches/${branchId}/group-blocks`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupBlocksQueryKey(branchId) }),
  });
}

export function useReleaseGroupBlockMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (blockId: string) => apiFetch<GroupBlockSummary>(`/group-blocks/${blockId}/release`, { method: 'PATCH', accessToken, tenantId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupBlocksQueryKey(branchId) }),
  });
}

export function useBookIntoGroupBlockMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ blockId, ...body }: { blockId: string; guest: { name: string; email?: string }; checkInDate: string; checkOutDate: string; adults: number }) =>
      apiFetch<{ reservationId: string; confirmationNumber: string }>(`/group-blocks/${blockId}/reservations`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: groupBlocksQueryKey(branchId) }),
  });
}

/** Mirrors `EventSpaceSummary`/`EventBookingSummary`. */
export interface EventSpaceSummary {
  id: string;
  name: string;
  category: string;
  capacity: number;
  createdAt: string;
}

export interface EventBookingSummary {
  id: string;
  eventSpaceId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  contactName: string | null;
  notes: string | null;
  createdAt: string;
}

function eventSpacesQueryKey(branchId: string) {
  return ['event-spaces', branchId] as const;
}

export function useEventSpacesQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: eventSpacesQueryKey(branchId ?? ''),
    queryFn: () => apiFetch<EventSpaceSummary[]>(`/branches/${branchId}/event-spaces`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useCreateEventSpaceMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; category: string; capacity: number }) =>
      apiFetch<EventSpaceSummary>(`/branches/${branchId}/event-spaces`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventSpacesQueryKey(branchId) }),
  });
}

function eventBookingsQueryKey(branchId: string, from: string, to: string) {
  return ['event-bookings', branchId, from, to] as const;
}

export function useEventBookingsQuery(branchId: string | null, from: string, to: string, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: eventBookingsQueryKey(branchId ?? '', from, to),
    queryFn: () => apiFetch<EventBookingSummary[]>(`/branches/${branchId}/event-bookings?from=${from}&to=${to}`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useCreateEventBookingMutation(branchId: string, from: string, to: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventSpaceId, ...body }: { eventSpaceId: string; title: string; startsAt: string; endsAt: string; contactName?: string; notes?: string }) =>
      apiFetch<EventBookingSummary>(`/event-spaces/${eventSpaceId}/bookings`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventBookingsQueryKey(branchId, from, to) }),
  });
}

export function useCancelEventBookingMutation(branchId: string, from: string, to: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => apiFetch<{ ok: true }>(`/event-bookings/${bookingId}`, { method: 'DELETE', accessToken, tenantId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventBookingsQueryKey(branchId, from, to) }),
  });
}
