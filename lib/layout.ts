import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import { roomsQueryKey } from './rooms';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/** Mirrors `PropertyService.getLayout` — every building and floor at the branch, empty ones too. */
export interface LayoutBuilding {
  id: string;
  /** `null` on the hidden default building ("Rooms Only" / "Floors Only" onboarding). */
  name: string | null;
  floors: Array<{ id: string; floorNumber: number; label: string | null; _count: { rooms: number } }>;
}

const layoutKey = (branchId: string) => ['layout', branchId] as const;

export function useLayoutQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: layoutKey(branchId ?? ''),
    queryFn: () => apiFetch<LayoutBuilding[]>(`/branches/${branchId}/layout`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

/** Every layout change can move rooms between floors or types — the layout, the rooms and the room types' counts all go stale. */
function useInvalidateLayout(branchId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: layoutKey(branchId) });
    queryClient.invalidateQueries({ queryKey: roomsQueryKey(branchId) });
  };
}

export type LayoutChange =
  | { kind: 'addBuilding'; name: string }
  | { kind: 'renameBuilding'; buildingId: string; name: string }
  | { kind: 'addFloor'; buildingId: string; floorNumber: number; label?: string }
  | { kind: 'updateFloor'; floorId: string; floorNumber?: number; label?: string }
  | { kind: 'addRooms'; roomTypeId: string; floorId: string; numbers: string[]; view?: string }
  | { kind: 'updateRoom'; roomId: string; number?: string; roomTypeId?: string; floorId?: string; view?: string; notes?: string }
  | { kind: 'removeRoom'; roomId: string };

/** One mutation for every Rooms & Layout edit — each kind is one call to its own route. */
export function useLayoutChangeMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const invalidate = useInvalidateLayout(branchId);
  return useMutation({
    mutationFn: (change: LayoutChange) => {
      const opts = { accessToken, tenantId };
      switch (change.kind) {
        case 'addBuilding':
          return apiFetch(`/branches/${branchId}/buildings`, { ...opts, method: 'POST', body: { name: change.name } });
        case 'renameBuilding':
          return apiFetch(`/buildings/${change.buildingId}`, { ...opts, method: 'PATCH', body: { name: change.name } });
        case 'addFloor':
          return apiFetch(`/buildings/${change.buildingId}/floors`, { ...opts, method: 'POST', body: { floorNumber: change.floorNumber, label: change.label } });
        case 'updateFloor':
          return apiFetch(`/floors/${change.floorId}`, { ...opts, method: 'PATCH', body: { floorNumber: change.floorNumber, label: change.label } });
        case 'addRooms':
          return apiFetch(`/branches/${branchId}/rooms/bulk`, {
            ...opts,
            method: 'POST',
            body: { roomTypeId: change.roomTypeId, floorId: change.floorId, numbers: change.numbers, view: change.view },
          });
        case 'updateRoom':
          return apiFetch(`/rooms/${change.roomId}`, {
            ...opts,
            method: 'PATCH',
            body: { number: change.number, roomTypeId: change.roomTypeId, floorId: change.floorId, view: change.view, notes: change.notes },
          });
        case 'removeRoom':
          return apiFetch(`/rooms/${change.roomId}`, { ...opts, method: 'DELETE' });
      }
    },
    onSuccess: invalidate,
  });
}

/**
 * "101-110, 112, PH-A" → ['101', …, '110', '112', 'PH-A']. A range keeps the
 * first number's width ("01-03" → 01, 02, 03). Returns an error instead for
 * a backwards or oversized range.
 */
export function expandRoomNumbers(text: string): { numbers: string[]; error?: string } {
  const numbers: string[] = [];
  for (const part of text.split(',').map((p) => p.trim()).filter(Boolean)) {
    const range = part.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      const from = Number(range[1]);
      const to = Number(range[2]);
      if (to < from) return { numbers: [], error: `"${part}" runs backwards` };
      if (to - from > 499) return { numbers: [], error: `"${part}" is more than 500 rooms` };
      for (let n = from; n <= to; n++) numbers.push(String(n).padStart(range[1].length, '0'));
    } else if (part.length > 20) {
      return { numbers: [], error: `"${part}" is longer than a room number can be` };
    } else {
      numbers.push(part);
    }
  }
  const unique = [...new Set(numbers)];
  if (unique.length > 500) return { numbers: [], error: 'Add at most 500 rooms at a time' };
  return { numbers: unique };
}
