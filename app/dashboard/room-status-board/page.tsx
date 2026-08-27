'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { CheckCircleIcon } from '@/components/ui/Icons';
import type { SelectOption } from '@/components/ui/Select';
import { groupRoomsByFloor } from '@/lib/groupRoomsByFloor';
import { useRoomsQuery } from '@/lib/rooms';
import { useAuthStore } from '@/lib/store/authStore';
import { RoomStatusFilters, type RoomStatusFiltersValue } from '../_components/RoomStatusFilters';
import { RoomGrid } from '../_components/RoomGrid';
import { RoomDetailPanel } from '../_components/RoomDetailPanel';
import { deriveRoomStatus } from '@/lib/deriveRoomStatus';

const EMPTY_FILTERS: RoomStatusFiltersValue = { status: '', buildingId: '', roomTypeId: '' };

/**
 * Room Status Board — reference page 19, reached via the Front Desk hub's
 * "In-House Management" card (`app/dashboard/page.tsx`), not the
 * `/dashboard` root itself — the hub is the actual landing page, matching
 * the reference's own IA (Roomick-UI.pdf page 10: `Operations > Front
 * Desk` lands on the hub; this board is one destination under it).
 * `app/dashboard/layout.tsx` has already gated auth and resolved
 * `activeBranchId` by the time this component renders, so no loading/
 * redirect states are duplicated here.
 */
export default function RoomStatusBoardPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const [filters, setFilters] = useState<RoomStatusFiltersValue>(EMPTY_FILTERS);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  const roomsQuery = useRoomsQuery(activeBranchId, { accessToken: accessToken ?? undefined, tenantId: user?.tenantId });
  const rooms = useMemo(() => roomsQuery.data ?? [], [roomsQuery.data]);

  const buildingOptions: SelectOption[] = useMemo(() => {
    const seen = new Map<string, string>();
    for (const room of rooms) seen.set(room.floor.building.id, room.floor.building.name ?? 'Main Building');
    return [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rooms]);

  const roomTypeOptions: SelectOption[] = useMemo(() => {
    const seen = new Map<string, string>();
    for (const room of rooms) seen.set(room.roomType.id, room.roomType.name);
    return [...seen.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [rooms]);

  const filteredRooms = useMemo(() => {
    return rooms.filter((room) => {
      if (filters.status && deriveRoomStatus(room.occupancyStatus, room.cleanlinessStatus, room.heldStatus) !== filters.status) {
        return false;
      }
      if (filters.buildingId && room.floor.building.id !== filters.buildingId) return false;
      if (filters.roomTypeId && room.roomType.id !== filters.roomTypeId) return false;
      return true;
    });
  }, [rooms, filters]);

  const buildings = useMemo(() => groupRoomsByFloor(filteredRooms), [filteredRooms]);
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? null;

  if (!activeBranchId) return null;

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-6">
      <PageHeader icon={<CheckCircleIcon className="size-8" />} title="Room Status Board" subtitle="See all rooms and their respective statuses" />

      <RoomStatusFilters value={filters} onChange={setFilters} buildingOptions={buildingOptions} roomTypeOptions={roomTypeOptions} />

      {roomsQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading rooms…</p>
      ) : roomsQuery.isError ? (
        <p className="text-body text-red-600">Could not load rooms. Please try refreshing.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-start">
          <RoomGrid buildings={buildings} selectedRoomId={selectedRoomId} onSelectRoom={setSelectedRoomId} />
          <RoomDetailPanel
            room={selectedRoom}
            branchId={activeBranchId}
            user={user}
            accessToken={accessToken ?? undefined}
            tenantId={user?.tenantId}
          />
        </div>
      )}
    </Container>
  );
}
