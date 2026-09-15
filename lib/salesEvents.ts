import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch, downloadFile } from './api';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/**
 * Mirrors `GroupBlockHoldState` (roomick-pms-backend/src/modules/sales-events/group-blocks.service.ts):
 * - `holding` — rooms are held out of general sale for the group until the cut-off;
 * - `lapsed` — the cut-off has passed and unbooked rooms are back on sale;
 * - `released` — released by hand;
 * - `none` — no stay dates (a block made before holds existed).
 */
export type GroupBlockHoldState = 'holding' | 'lapsed' | 'released' | 'none';

/** Mirrors `GroupBlockSummary`. `pickup` is always counted live from real reservations, never stored. */
export interface GroupBlockSummary {
  id: string;
  name: string;
  roomTypeId: string;
  roomTypeName: string;
  blockSize: number;
  blockRate: string;
  arrivalDate: string | null;
  departureDate: string | null;
  cutoffDate: string;
  status: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  pickup: number;
  holdState: GroupBlockHoldState;
  roomsHeld: number;
  createdAt: string;
}

/** One guest on a rooming list — blank columns are left out, not sent empty. */
export interface RoomingListRow {
  guestName: string;
  email?: string;
  phone?: string;
  checkInDate?: string;
  checkOutDate?: string;
  adults?: number;
  children?: number;
  specialRequests?: string;
}

export interface RoomingListResult {
  created: Array<{ row: number; guestName: string; confirmationNumber: string; reservationId: string }>;
  failed: Array<{ row: number; guestName: string; message: string }>;
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

/** A block's held rooms change what's for sale everywhere — the availability views re-read. */
function invalidateAfterBlockChange(queryClient: ReturnType<typeof useQueryClient>, branchId: string) {
  queryClient.invalidateQueries({ queryKey: groupBlocksQueryKey(branchId) });
  queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('availability') });
}

export function useCreateGroupBlockMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      roomTypeId: string;
      blockSize: number;
      blockRate: number;
      arrivalDate: string;
      departureDate: string;
      cutoffDate: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
    }) => apiFetch<GroupBlockSummary>(`/branches/${branchId}/group-blocks`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => invalidateAfterBlockChange(queryClient, branchId),
  });
}

export function useReleaseGroupBlockMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (blockId: string) => apiFetch<GroupBlockSummary>(`/group-blocks/${blockId}/release`, { method: 'PATCH', accessToken, tenantId }),
    onSuccess: () => invalidateAfterBlockChange(queryClient, branchId),
  });
}

export function useBookIntoGroupBlockMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      blockId,
      ...body
    }: {
      blockId: string;
      guest: { name: string; email?: string };
      checkInDate?: string;
      checkOutDate?: string;
      adults: number;
    }) => apiFetch<{ reservationId: string; confirmationNumber: string }>(`/group-blocks/${blockId}/reservations`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => invalidateAfterBlockChange(queryClient, branchId),
  });
}

export function useImportRoomingListMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ blockId, rows }: { blockId: string; rows: RoomingListRow[] }) =>
      apiFetch<RoomingListResult>(`/group-blocks/${blockId}/rooming-list`, { method: 'POST', accessToken, tenantId, body: { rows } }),
    onSuccess: () => invalidateAfterBlockChange(queryClient, branchId),
  });
}

// --- Event spaces and bookings ------------------------------------------------------

export type SetupStyle = 'theater' | 'classroom' | 'banquet' | 'u_shape';

export const SETUP_STYLE_LABELS: Record<SetupStyle, string> = {
  theater: 'Theatre',
  classroom: 'Classroom',
  banquet: 'Banquet',
  u_shape: 'U-shape',
};

/** Mirrors `EventSpaceSummary`. `setupCapacities` = seats per layout; a layout left out falls back to `capacity`. */
export interface EventSpaceSummary {
  id: string;
  name: string;
  category: string;
  capacity: number;
  setupCapacities: Partial<Record<SetupStyle, number>> | null;
  createdAt: string;
}

export interface CateringLine {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface EventBookingSummary {
  id: string;
  eventSpaceId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  setupStyle: SetupStyle | null;
  headcount: number | null;
  catering: CateringLine[];
  avRequirements: string | null;
  notes: string | null;
  createdAt: string;
}

/** Mirrors `EventBookingDetail` — the catering priced by the server, tax by the branch's F&B rules. */
export interface EventBookingDetail extends EventBookingSummary {
  space: EventSpaceSummary;
  currency: string;
  cateringLines: Array<CateringLine & { amount: string }>;
  totals: { subtotal: string; taxTotal: string; total: string };
}

/** Seats for a layout — the space's figure for it, else its general capacity. */
export function seatsFor(space: EventSpaceSummary, setupStyle: SetupStyle | null): number {
  return (setupStyle ? space.setupCapacities?.[setupStyle] : undefined) ?? space.capacity;
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
    mutationFn: (body: { name: string; category: string; capacity: number; setupCapacities?: Partial<Record<SetupStyle, number>> }) =>
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
    mutationFn: ({
      eventSpaceId,
      ...body
    }: {
      eventSpaceId: string;
      title: string;
      startsAt: string;
      endsAt: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
      setupStyle?: SetupStyle;
      headcount?: number;
      notes?: string;
    }) => apiFetch<EventBookingSummary>(`/event-spaces/${eventSpaceId}/bookings`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventBookingsQueryKey(branchId, from, to) }),
  });
}

export function useEventBookingQuery(bookingId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['event-booking', bookingId ?? ''] as const,
    queryFn: () => apiFetch<EventBookingDetail>(`/event-bookings/${bookingId}`, { accessToken, tenantId }),
    enabled: bookingId !== null,
  });
}

/** Leave a field out to keep it; `null` clears it. */
export type EventBookingChanges = Partial<{
  title: string;
  startsAt: string;
  endsAt: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  setupStyle: SetupStyle | null;
  headcount: number | null;
  catering: CateringLine[];
  avRequirements: string | null;
  notes: string | null;
}>;

export function useUpdateEventBookingMutation(branchId: string, from: string, to: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ bookingId, ...body }: EventBookingChanges & { bookingId: string }) =>
      apiFetch<EventBookingDetail>(`/event-bookings/${bookingId}`, { method: 'PATCH', accessToken, tenantId, body }),
    onSuccess: (detail) => {
      queryClient.setQueryData(['event-booking', detail.id], detail);
      queryClient.invalidateQueries({ queryKey: eventBookingsQueryKey(branchId, from, to) });
    },
  });
}

export function useCancelEventBookingMutation(branchId: string, from: string, to: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (bookingId: string) => apiFetch<{ ok: true }>(`/event-bookings/${bookingId}`, { method: 'DELETE', accessToken, tenantId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventBookingsQueryKey(branchId, from, to) }),
  });
}

/** Downloads the Banquet Event Order PDF — through `downloadFile`, since the route needs the auth headers a plain link can't carry. */
export function downloadBeo(booking: { id: string; title: string }, auth: AuthOpts): Promise<void> {
  const slug = booking.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return downloadFile(`/event-bookings/${booking.id}/beo`, `beo-${slug || 'event'}.pdf`, auth);
}
