import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import type { OccupancyStatus, CleanlinessStatus, HeldStatus } from './deriveRoomStatus';

/** Mirrors `RoomsService.listRoomsForBranch`'s response shape (roomick-pms-backend/src/modules/property/rooms.service.ts) — one row per room, floor/building/room-type already nested so the grid needs no separate list calls. */
export interface RoomWithDetails {
  id: string;
  number: string;
  view: string | null;
  notes: string | null;
  occupancyStatus: OccupancyStatus;
  cleanlinessStatus: CleanlinessStatus;
  heldStatus: HeldStatus;
  roomType: { id: string; name: string; bedType: string | null };
  floor: {
    id: string;
    floorNumber: number;
    label: string | null;
    building: { id: string; name: string | null };
  };
}

export function roomsQueryKey(branchId: string) {
  return ['rooms', branchId] as const;
}

export function useRoomsQuery(
  branchId: string | null,
  { accessToken, tenantId }: { accessToken: string | undefined; tenantId: string | undefined },
) {
  return useQuery({
    queryKey: roomsQueryKey(branchId ?? ''),
    queryFn: () => apiFetch<RoomWithDetails[]>(`/branches/${branchId}/rooms`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export interface RoomTypeSummary {
  id: string;
  name: string;
  baseRate: string;
  /** The backend's own `listRoomTypes` already returns every column (no `select`) — this was just never typed on the frontend until the capacity cap needed it. */
  capacity: { adults: number; children: number };
  bedType: string | null;
  sizeM2: string | null;
  amenities: string[];
  photoUrls: string[];
  sortOrder: number | null;
}

function roomTypesQueryKey(branchId: string) {
  return ['room-types', branchId] as const;
}

/** `GET /branches/:branchId/room-types` — already built for onboarding, unused by any post-onboarding screen until Walk-In Booking needed a room-type picker outside the wizard's own local draft state. */
export function useRoomTypesQuery(
  branchId: string | null,
  { accessToken, tenantId }: { accessToken: string | undefined; tenantId: string | undefined },
) {
  return useQuery({
    queryKey: roomTypesQueryKey(branchId ?? ''),
    queryFn: () => apiFetch<RoomTypeSummary[]>(`/branches/${branchId}/room-types`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

interface RoomTypeInput {
  name: string;
  baseRate: number;
  capacity: { adults: number; children: number };
  bedType?: string;
  sizeM2?: number;
  amenities?: string[];
  photoUrls?: string[];
  sortOrder?: number;
}

/** Property Config's own "add a room type after onboarding" — the same `POST` onboarding already uses, just callable from a real page instead of only the signup wizard's local draft state. */
export function useCreateRoomTypeMutation(branchId: string, { accessToken, tenantId }: { accessToken: string | undefined; tenantId: string | undefined }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RoomTypeInput) => apiFetch<RoomTypeSummary>(`/branches/${branchId}/room-types`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomTypesQueryKey(branchId) }),
  });
}

/** Never retroactively reprices an existing reservation — see `RoomsService.updateRoomType`'s own comment (roomick-pms-backend). */
export function useUpdateRoomTypeMutation(branchId: string, { accessToken, tenantId }: { accessToken: string | undefined; tenantId: string | undefined }) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomTypeId, ...body }: Partial<RoomTypeInput> & { roomTypeId: string }) =>
      apiFetch<RoomTypeSummary>(`/room-types/${roomTypeId}`, { method: 'PATCH', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: roomTypesQueryKey(branchId) }),
  });
}

interface ChangeRoomStatusInput {
  roomId: string;
  occupancyStatus?: OccupancyStatus;
  cleanlinessStatus?: CleanlinessStatus;
  heldStatus?: HeldStatus;
  reason?: string;
}

/**
 * Invalidate-and-refetch, not an optimistic update — simple and correct
 * for this first slice; `deriveRoomStatus`'s own header comment already
 * prefers re-deriving from server truth over locally-guessed state, and a
 * front-desk shift's status changes aren't frequent enough to need the
 * extra complexity optimistic updates would add.
 */
export function useChangeRoomStatusMutation(
  branchId: string,
  { accessToken, tenantId }: { accessToken: string | undefined; tenantId: string | undefined },
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ roomId, ...body }: ChangeRoomStatusInput) =>
      apiFetch(`/rooms/${roomId}/status`, { method: 'PATCH', accessToken, tenantId, body }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roomsQueryKey(branchId) });
    },
  });
}
