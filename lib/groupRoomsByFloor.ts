import type { RoomWithDetails } from './rooms';

export interface FloorGroup {
  floorId: string;
  floorLabel: string;
  rooms: RoomWithDetails[];
}

export interface BuildingGroup {
  buildingId: string;
  buildingName: string;
  floors: FloorGroup[];
}

/** "Ground Floor" for 0, "Floor N" otherwise — mirrors `schema.prisma`'s own `// 0 = ground floor` convention already used throughout onboarding. A real per-floor `label` (if the owner set one) wins over the generated one. Exported so `RoomDetailPanel` can render the same label for a single room without duplicating this rule. */
export function floorLabel(floorNumber: number, label: string | null): string {
  if (label) return label;
  return floorNumber === 0 ? 'Ground Floor' : `Floor ${floorNumber}`;
}

/**
 * Groups a flat room list into building → floor → room[], sorted building
 * name → floor number → room number — matching the Room Status Board
 * reference exactly (page 19: "Building(s)" card, one sub-card per
 * building, floor rows within each). `building.name: null` (the hidden
 * default building auto-created by "Rooms Only" onboarding, see
 * `PropertyService.findOrCreateDefaultFloor`) falls back to "Main
 * Building" rather than showing a blank header.
 */
export function groupRoomsByFloor(rooms: RoomWithDetails[]): BuildingGroup[] {
  const buildings = new Map<string, BuildingGroup>();

  for (const room of rooms) {
    const { building, id: floorId, floorNumber, label } = room.floor;
    let buildingGroup = buildings.get(building.id);
    if (!buildingGroup) {
      buildingGroup = { buildingId: building.id, buildingName: building.name ?? 'Main Building', floors: [] };
      buildings.set(building.id, buildingGroup);
    }
    let floorGroup = buildingGroup.floors.find((f) => f.floorId === floorId);
    if (!floorGroup) {
      floorGroup = { floorId, floorLabel: floorLabel(floorNumber, label), rooms: [] };
      buildingGroup.floors.push(floorGroup);
    }
    floorGroup.rooms.push(room);
  }

  const result = [...buildings.values()];
  result.sort((a, b) => a.buildingName.localeCompare(b.buildingName));
  for (const b of result) {
    b.floors.sort((a, c) => a.rooms[0].floor.floorNumber - c.rooms[0].floor.floorNumber);
    for (const f of b.floors) {
      f.rooms.sort((a, c) => a.number.localeCompare(c.number, undefined, { numeric: true }));
    }
  }
  return result;
}
