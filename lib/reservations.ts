import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { roomsQueryKey } from './rooms';
import type { GuestSummary, GuestInput } from './guests';

export type ReservationStatus = 'waitlisted' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled' | 'no_show' | 'walked';
export type ReservationChannel = 'direct' | 'walk_in' | 'booking_com' | 'expedia' | 'agoda' | 'airbnb';

/** Mirrors `ReservationsService`'s response shape (RESERVATION_INCLUDE, roomick-pms-backend/src/modules/reservations/reservations.service.ts). */
export interface ReservationSummary {
  id: string;
  confirmationNumber: string;
  status: ReservationStatus;
  channel: ReservationChannel;
  checkInDate: string;
  checkOutDate: string;
  actualCheckIn: string | null;
  actualCheckOut: string | null;
  adults: number;
  children: number;
  confirmedRate: string;
  guest: GuestSummary;
  roomType: { id: string; name: string };
  room: { id: string; number: string } | null;
  /** The branch's ISO 4217 code — feed to `currencySymbolFor` for display. */
  branch: { currency: string };
}

export interface AvailabilityNight {
  date: string;
  available: number;
}

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };
type GuestRef = { guestId: string } | { guest: GuestInput };

export function reservationsQueryKey(kind: 'arrivals' | 'departures' | 'inHouse', branchId: string, date?: string) {
  return ['reservations', kind, branchId, date ?? null] as const;
}

export function useArrivalsQuery(branchId: string | null, date: string | undefined, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: reservationsQueryKey('arrivals', branchId ?? '', date),
    queryFn: () => apiFetch<ReservationSummary[]>(`/branches/${branchId}/arrivals${date ? `?date=${date}` : ''}`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useDeparturesQuery(branchId: string | null, date: string | undefined, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: reservationsQueryKey('departures', branchId ?? '', date),
    queryFn: () => apiFetch<ReservationSummary[]>(`/branches/${branchId}/departures${date ? `?date=${date}` : ''}`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useInHouseQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: reservationsQueryKey('inHouse', branchId ?? ''),
    queryFn: () => apiFetch<ReservationSummary[]>(`/branches/${branchId}/in-house`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useReservationQuery(reservationId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['reservation', reservationId] as const,
    queryFn: () => apiFetch<ReservationSummary>(`/reservations/${reservationId}`, { accessToken, tenantId }),
    enabled: reservationId !== null,
  });
}

/** Pre-submit hint only — the backend re-validates for real at create/check-in/walk-in time regardless. */
export function useAvailabilityQuery(
  branchId: string | null,
  roomTypeId: string | null,
  from: string | null,
  to: string | null,
  { accessToken, tenantId }: AuthOpts,
) {
  return useQuery({
    queryKey: ['availability', branchId, roomTypeId, from, to] as const,
    queryFn: () =>
      apiFetch<AvailabilityNight[]>(`/branches/${branchId}/availability?from=${from}&to=${to}&roomTypeId=${roomTypeId}`, {
        accessToken,
        tenantId,
      }),
    enabled: Boolean(branchId && roomTypeId && from && to),
  });
}

function invalidateAfterLifecycleChange(queryClient: ReturnType<typeof useQueryClient>, branchId: string) {
  queryClient.invalidateQueries({ queryKey: ['reservations', 'arrivals', branchId] });
  queryClient.invalidateQueries({ queryKey: ['reservations', 'departures', branchId] });
  queryClient.invalidateQueries({ queryKey: ['reservations', 'inHouse', branchId] });
  queryClient.invalidateQueries({ queryKey: roomsQueryKey(branchId) });
  // Every status/date/room-type change here also affects the general
  // search list (Modify/Cancel/Waitlist's own "find it" step) and, for
  // anything that changes which nights are held, the availability
  // calendar — cheaper to always invalidate both than to reason per
  // mutation about which ones actually moved the needle.
  queryClient.invalidateQueries({ queryKey: ['reservations', 'search', branchId] });
  queryClient.invalidateQueries({ queryKey: ['availability-calendar', branchId] });
}

export function useCreateReservationMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (
      body: GuestRef & {
        roomTypeId: string;
        checkInDate: string;
        checkOutDate: string;
        adults: number;
        children?: number;
        specialRequests?: string;
        channel?: ReservationChannel;
        /** Skips the availability check and books as `waitlisted` — the explicit Waitlist Management path, not an automatic fallback. */
        joinWaitlist?: boolean;
      },
    ) => apiFetch<ReservationSummary>(`/branches/${branchId}/reservations`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => invalidateAfterLifecycleChange(queryClient, branchId),
  });
}

/**
 * The general search behind Modify Reservation, Cancel Reservation, and
 * Waitlist Management's "find the reservation" step, and the Reservations
 * hub's own stat cards. `enabled` defaults to true (unlike this file's
 * other queries) — the Reservations hub wants its stats on mount with no
 * search term yet, which every other query here treats as "nothing to
 * fetch" via a null id.
 */
export function useReservationsQuery(
  branchId: string | null,
  filter: { status?: ReservationStatus; search?: string },
  { accessToken, tenantId }: AuthOpts,
  enabled = true,
) {
  const params = new URLSearchParams();
  if (filter.status) params.set('status', filter.status);
  if (filter.search) params.set('search', filter.search);
  const qs = params.toString();
  return useQuery({
    queryKey: ['reservations', 'search', branchId ?? '', filter.status ?? null, filter.search ?? ''] as const,
    queryFn: () => apiFetch<ReservationSummary[]>(`/branches/${branchId}/reservations${qs ? `?${qs}` : ''}`, { accessToken, tenantId }),
    enabled: enabled && branchId !== null,
  });
}

export interface AvailabilityCalendarRoomType {
  roomTypeId: string;
  roomTypeName: string;
  nights: AvailabilityNight[];
}
export interface AvailabilityCalendar {
  year: number;
  month: number;
  roomTypes: AvailabilityCalendarRoomType[];
}

export function useAvailabilityCalendarQuery(branchId: string | null, year: number, month: number, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['availability-calendar', branchId, year, month] as const,
    queryFn: () =>
      apiFetch<AvailabilityCalendar>(`/branches/${branchId}/availability-calendar?year=${year}&month=${month}`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useModifyReservationMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      reservationId,
      ...body
    }: {
      reservationId: string;
      checkInDate?: string;
      checkOutDate?: string;
      roomTypeId?: string;
      adults?: number;
      children?: number;
      reason: string;
    }) => apiFetch<ReservationSummary>(`/reservations/${reservationId}/modify`, { method: 'PATCH', accessToken, tenantId, body }),
    onSuccess: () => invalidateAfterLifecycleChange(queryClient, branchId),
  });
}

export function usePromoteFromWaitlistMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reservationId: string) =>
      apiFetch<ReservationSummary>(`/reservations/${reservationId}/promote`, { method: 'POST', accessToken, tenantId }),
    onSuccess: () => invalidateAfterLifecycleChange(queryClient, branchId),
  });
}

export function useCreateWalkInMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: GuestRef & { roomTypeId: string; roomId: string; checkOutDate: string; adults: number; children?: number; specialRequests?: string }) =>
      apiFetch<ReservationSummary>(`/branches/${branchId}/reservations/walk-in`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => invalidateAfterLifecycleChange(queryClient, branchId),
  });
}

export function useCheckInMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reservationId, roomId }: { reservationId: string; roomId?: string }) =>
      apiFetch<ReservationSummary>(`/reservations/${reservationId}/check-in`, { method: 'POST', accessToken, tenantId, body: { roomId } }),
    onSuccess: () => invalidateAfterLifecycleChange(queryClient, branchId),
  });
}

export function useCheckOutMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reservationId: string) =>
      apiFetch<ReservationSummary>(`/reservations/${reservationId}/check-out`, { method: 'POST', accessToken, tenantId }),
    onSuccess: () => invalidateAfterLifecycleChange(queryClient, branchId),
  });
}

export function useCancelReservationMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reservationId, reason }: { reservationId: string; reason?: string }) =>
      apiFetch<ReservationSummary>(`/reservations/${reservationId}/cancel`, { method: 'POST', accessToken, tenantId, body: { reason } }),
    onSuccess: () => invalidateAfterLifecycleChange(queryClient, branchId),
  });
}
