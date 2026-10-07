'use client';

import { useMemo, useState } from 'react';
import { Select, type SelectOption } from '@/components/ui/Select';
import { groupRoomsByFloor } from '@/lib/groupRoomsByFloor';
import type { RoomWithDetails } from '@/lib/rooms';
import { RoomGrid } from './RoomGrid';

/** Clean or inspected — a room a guest can walk into now. */
export function isReady(room: RoomWithDetails): boolean {
  return room.cleanlinessStatus === 'clean' || room.cleanlinessStatus === 'inspected';
}

/** Free to give a guest: nobody in it and not held. Being cleaned is the only thing short of ready a picker may still show. */
function isFree(room: RoomWithDetails): boolean {
  return room.occupancyStatus === 'vacant' && room.heldStatus === null;
}

/**
 * Room grid with the reference's Manual Room Override filters ("Room grid
 * (floor map view), Status color coding, Filter: floor / status / type") —
 * free rooms only (nobody in them, not held), ready ones by default, the
 * colours the Room Status Board uses. Shared by the check-in override and
 * Room Move.
 */
export function RoomPicker({
  rooms,
  excludeRoomId,
  initialTypeId = '',
  selectedRoomId,
  onSelect,
}: {
  rooms: RoomWithDetails[];
  /** The guest's own room, when they're moving out of it. */
  excludeRoomId?: string;
  /** Start filtered to one room type ('' = every type). */
  initialTypeId?: string;
  selectedRoomId: string | null;
  onSelect: (room: RoomWithDetails) => void;
}) {
  const [typeId, setTypeId] = useState(initialTypeId);
  const [floorId, setFloorId] = useState('');
  const [status, setStatus] = useState<'ready' | 'any'>('ready');

  const free = useMemo(() => rooms.filter((room) => isFree(room) && room.id !== excludeRoomId), [rooms, excludeRoomId]);
  const typeOptions: SelectOption[] = useMemo(() => {
    const types = new Map(free.map((room) => [room.roomType.id, room.roomType.name]));
    return [{ value: '', label: 'Every room type' }, ...[...types].map(([value, label]) => ({ value, label }))];
  }, [free]);
  const floorOptions: SelectOption[] = useMemo(() => {
    const floors = new Map<string, string>();
    for (const room of free) {
      const name = room.floor.label ?? `Floor ${room.floor.floorNumber}`;
      floors.set(room.floor.id, room.floor.building.name ? `${room.floor.building.name} · ${name}` : name);
    }
    return [{ value: '', label: 'Every floor' }, ...[...floors].map(([value, label]) => ({ value, label }))];
  }, [free]);

  const shown = free.filter((room) => (!typeId || room.roomType.id === typeId) && (!floorId || room.floor.id === floorId) && (status === 'any' || isReady(room)));
  const byId = new Map(shown.map((room) => [room.id, room]));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2">
        <Select id="room-picker-type" name="roomPickerType" label="Room type" options={typeOptions} value={typeId} onChange={setTypeId} />
        <Select id="room-picker-floor" name="roomPickerFloor" label="Floor" options={floorOptions} value={floorId} onChange={setFloorId} />
        <Select
          id="room-picker-status"
          name="roomPickerStatus"
          label="Status"
          options={[
            { value: 'ready', label: 'Ready — clean or inspected' },
            { value: 'any', label: 'Every free room, being cleaned too' },
          ]}
          value={status}
          onChange={(value) => setStatus(value as 'ready' | 'any')}
        />
      </div>
      <RoomGrid
        buildings={groupRoomsByFloor(shown)}
        selectedRoomId={selectedRoomId}
        onSelectRoom={(roomId) => {
          const room = byId.get(roomId);
          if (room) onSelect(room);
        }}
      />
    </div>
  );
}
