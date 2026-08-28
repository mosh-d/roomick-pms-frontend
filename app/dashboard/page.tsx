'use client';

import { useMemo } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  CheckCircleIcon,
  CityDepartureIcon,
  ClipboardListIcon,
  HotelCheckInIcon,
  HotelCheckOutIcon,
  PlaneLandingIcon,
  RoomChangeIcon,
  WalkInIcon,
} from '@/components/ui/Icons';
import { deriveRoomStatus } from '@/lib/deriveRoomStatus';
import { useRoomsQuery } from '@/lib/rooms';
import { useArrivalsQuery, useDeparturesQuery, useInHouseQuery } from '@/lib/reservations';
import { useAuthStore } from '@/lib/store/authStore';
import { HubCard } from './_components/HubCard';

/**
 * Front Desk hub (Roomick-UI.pdf page 10) — the actual `/dashboard`
 * landing page. Three sections (Check-In, Check-Out, In-House Management),
 * each a row of cards. Only "Room Status Board" is real today — see
 * `HubCard.tsx`'s own header comment for why the rest render inert rather
 * than omitted or linked nowhere.
 */
export default function FrontDeskHubPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);

  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };
  // Shares its cache with room-status-board/page.tsx's own `useRoomsQuery`
  // call (same query key) — real numbers for the one card that has them,
  // no second network round-trip once either page has fetched.
  const roomsQuery = useRoomsQuery(activeBranchId, auth);
  const arrivalsQuery = useArrivalsQuery(activeBranchId, undefined, auth);
  const departuresQuery = useDeparturesQuery(activeBranchId, undefined, auth);
  const inHouseQuery = useInHouseQuery(activeBranchId, auth);

  const roomStatusStats = useMemo(() => {
    const rooms = roomsQuery.data ?? [];
    if (rooms.length === 0) return undefined;
    let vacant = 0;
    let occupied = 0;
    let cleaning = 0;
    let held = 0;
    for (const room of rooms) {
      switch (deriveRoomStatus(room.occupancyStatus, room.cleanlinessStatus, room.heldStatus)) {
        case 'vacant':
          vacant++;
          break;
        case 'occupied':
          occupied++;
          break;
        case 'cleaning':
          cleaning++;
          break;
        default:
          held++;
      }
    }
    return [`${vacant} vacant rooms`, `${occupied} occupied rooms`, `${cleaning} being cleaned`, `${held} held`];
  }, [roomsQuery.data]);

  if (!activeBranchId) return null;

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader
        title="Front Desk"
        subtitle="Primary operational hub for receptionists. Arrivals, departures, in-house management, and walk-ins."
      />

      <Section label="Check-In">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <HubCard
            icon={<PlaneLandingIcon className="size-5" />}
            title="Arrivals Dashboard"
            description="Today's expected arrivals, status, room readiness"
            stats={arrivalsQuery.data ? [`${arrivalsQuery.data.length} pending arrivals today`] : undefined}
            href="/dashboard/arrivals"
          />
          <HubCard
            icon={<HotelCheckInIcon className="size-5" />}
            title="Check-In Flow"
            description="Room assignment for an arriving guest"
            href="/dashboard/check-in"
          />
          <HubCard
            icon={<WalkInIcon className="size-5" />}
            title="Walk-In Booking"
            description="Create reservation and check-in in one flow"
            href="/dashboard/walk-in-booking"
          />
        </div>
      </Section>

      <Section label="Check-Out">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <HubCard
            icon={<CityDepartureIcon className="size-5" />}
            title="Departures Dashboard"
            description="Today's expected departures"
            stats={departuresQuery.data ? [`${departuresQuery.data.length} guests departing today`] : undefined}
            href="/dashboard/departures"
          />
          <HubCard
            icon={<HotelCheckOutIcon className="size-5" />}
            title="Check-Out Flow"
            description="Release a departing guest's room"
            href="/dashboard/check-out"
          />
          <HubCard icon={<RoomChangeIcon className="size-5" />} title="Room Change" description="Switch guest to a different room" />
        </div>
      </Section>

      <Section label="In-House Management">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <HubCard
            icon={<ClipboardListIcon className="size-5" />}
            title="In-House Guest List"
            description="All currently checked-in guests"
            stats={inHouseQuery.data ? [`${inHouseQuery.data.length} checked-in guests`] : undefined}
            href="/dashboard/in-house-guest-list"
          />
          <HubCard
            icon={<CheckCircleIcon className="size-5" />}
            title="Room Status Board"
            description="Live grid of all rooms and their status"
            stats={roomStatusStats}
            href="/dashboard/room-status-board"
          />
        </div>
      </Section>
    </Container>
  );
}
