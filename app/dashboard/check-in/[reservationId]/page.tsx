'use client';

import { useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useReservationQuery, useCheckInMutation } from '@/lib/reservations';
import { useRoomsQuery } from '@/lib/rooms';
import { groupRoomsByFloor } from '@/lib/groupRoomsByFloor';
import { RoomGrid } from '../../_components/RoomGrid';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * Check-In Flow (Roomick-UI.pdf page 12/13), trimmed to what's real this
 * pass: guest summary + room assignment. The reference's ID Capture and
 * Payment sections need ID-document encryption and Folios/Payments
 * (neither built) — deferred, not faked. Reuses `RoomGrid`/`RoomCell`
 * exactly as `room-status-board/page.tsx` composes them, filtered to
 * vacant/clean-or-inspected rooms of the reservation's own room type — the
 * same client-side filter, no new backend endpoint needed for the list.
 */
export default function CheckInFlowPage() {
  const params = useParams<{ reservationId: string }>();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reservationQuery = useReservationQuery(params.reservationId, auth);
  const roomsQuery = useRoomsQuery(activeBranchId, auth);
  const checkInMutation = useCheckInMutation(activeBranchId ?? '', auth);

  const reservation = reservationQuery.data;

  const readyRooms = useMemo(() => {
    if (!reservation) return [];
    return (roomsQuery.data ?? []).filter(
      (room) =>
        room.roomType.id === reservation.roomType.id &&
        room.occupancyStatus === 'vacant' &&
        room.heldStatus === null &&
        (['clean', 'inspected'] as string[]).includes(room.cleanlinessStatus),
    );
  }, [roomsQuery.data, reservation]);

  const buildings = useMemo(() => groupRoomsByFloor(readyRooms), [readyRooms]);

  if (!activeBranchId) return null;

  async function handleConfirm() {
    if (!selectedRoomId) return;
    setActionError(null);
    try {
      await checkInMutation.mutateAsync({ reservationId: params.reservationId, roomId: selectedRoomId });
      router.push('/dashboard/arrivals');
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-6">
      <div>
        <h1 className="font-display text-title font-bold text-secondary mb-1">Check-In Flow</h1>
        <p className="text-body text-secondary-light">Check a guest in</p>
      </div>

      {reservationQuery.isLoading || roomsQuery.isLoading ? (
        <p className="text-body text-secondary-light">Loading…</p>
      ) : reservationQuery.isError || !reservation ? (
        <p className="text-body text-red-600">Could not load this reservation.</p>
      ) : reservation.status !== 'confirmed' ? (
        <p className="text-body text-red-600">This reservation is already {reservation.status.replace('_', ' ')} — nothing to check in.</p>
      ) : (
        <>
          <Card tone="secondary" className="flex flex-col gap-2">
            <h2 className="text-body font-bold text-secondary">Guest Details</h2>
            <Row label="Name" value={reservation.guest.name} />
            <Row label="Email" value={reservation.guest.email ?? 'NIL'} />
            <Row label="Phone" value={reservation.guest.phone ?? 'NIL'} />
            <Row label="Room Type" value={reservation.roomType.name} />
            <Row label="Confirmation #" value={reservation.confirmationNumber} />
          </Card>

          <div>
            <h2 className="text-body font-bold text-secondary mb-3">Room Selection</h2>
            {buildings.length === 0 ? (
              <p className="text-body text-secondary-light">No ready rooms of this type — nothing vacant and clean/inspected right now.</p>
            ) : (
              <RoomGrid buildings={buildings} selectedRoomId={selectedRoomId} onSelectRoom={setSelectedRoomId} />
            )}
          </div>

          {actionError ? <p className="text-small text-red-600">{actionError}</p> : null}

          <Button type="button" onClick={handleConfirm} disabled={!selectedRoomId || checkInMutation.isPending} loading={checkInMutation.isPending} className="self-start">
            Confirm Check-In
          </Button>
        </>
      )}
    </Container>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-small text-secondary-light">{label}</span>
      <span className="text-body font-semibold text-secondary">{value}</span>
    </div>
  );
}
