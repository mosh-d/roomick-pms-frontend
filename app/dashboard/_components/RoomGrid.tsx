'use client';

import { Card } from '@/components/ui/Card';
import type { BuildingGroup } from '@/lib/groupRoomsByFloor';
import { RoomCell } from './RoomCell';

/**
 * "Building(s)" card from reference page 19 — a building sub-card per
 * building, a floor row per floor (label left, wrapped room chips right),
 * divided by a thin rule. Reuses `Card`'s own `secondary` tone nesting
 * (see Card.tsx) for the building sub-cards rather than a hand-tuned
 * second shade — nesting one `Card` inside another already produces the
 * right "one level deeper" tint for free.
 */
export function RoomGrid({
  buildings,
  selectedRoomId,
  onSelectRoom,
}: {
  buildings: BuildingGroup[];
  selectedRoomId: string | null;
  onSelectRoom: (roomId: string) => void;
}) {
  if (buildings.length === 0) {
    return (
      <Card tone="secondary">
        <p className="text-body text-secondary-light">No rooms match the current filters.</p>
      </Card>
    );
  }

  return (
    <Card tone="secondary" className="flex flex-col gap-4">
      <h2 className="text-body font-bold text-secondary text-center">Building(s)</h2>
      {buildings.map((building) => (
        <Card key={building.buildingId} tone="secondary" className="flex flex-col gap-2">
          <h3 className="text-small font-bold text-secondary-light">{building.buildingName}</h3>
          <div className="flex flex-col">
            {building.floors.map((floor, index) => (
              <div
                key={floor.floorId}
                className={`flex flex-wrap items-center gap-4 py-3 ${
                  index > 0 ? 'border-t border-secondary/20' : ''
                }`}
              >
                <span className="w-28 shrink-0 text-small font-semibold text-secondary">{floor.floorLabel}</span>
                <div className="flex flex-wrap gap-2">
                  {floor.rooms.map((room) => (
                    <RoomCell key={room.id} room={room} selected={room.id === selectedRoomId} onSelect={onSelectRoom} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </Card>
  );
}
