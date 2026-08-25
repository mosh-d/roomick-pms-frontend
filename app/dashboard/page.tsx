'use client';

import { useMemo } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { CheckCircleIcon } from '@/components/ui/Icons';
import { deriveRoomStatus } from '@/lib/deriveRoomStatus';
import { useRoomsQuery } from '@/lib/rooms';
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

  // Shares its cache with room-status-board/page.tsx's own `useRoomsQuery`
  // call (same query key) — real numbers for the one card that has them,
  // no second network round-trip once either page has fetched.
  const roomsQuery = useRoomsQuery(activeBranchId, { accessToken: accessToken ?? undefined, tenantId: user?.tenantId });

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
      <div>
        <h1 className="font-display text-title font-bold text-secondary mb-1">Front Desk</h1>
        <p className="text-body text-secondary-light">
          Primary operational hub for receptionists. Arrivals, departures, in-house management, and walk-ins.
        </p>
      </div>

      <Section label="Check-In">
        <div className="flex flex-wrap gap-4">
          <HubCard title="Arrivals Dashboard" description="Today's expected arrivals, status, room readiness" />
          <HubCard title="Check-In Flow" description="ID capture, room assignment, folio activation" />
          <HubCard title="Walk-In Booking" description="Create reservation and check-in in one flow" />
        </div>
      </Section>

      <Section label="Check-Out">
        <div className="flex flex-wrap gap-4">
          <HubCard title="Departures Dashboard" description="Today's expected departures, folio status" />
          <HubCard title="Check-Out Flow" description="Folio review, final payment, room release" />
          <HubCard title="Room Change" description="Switch guest to a different room" />
        </div>
      </Section>

      <Section label="In-House Management">
        <div className="flex flex-wrap gap-4">
          <HubCard title="In-House Guest List" description="All currently checked-in guests" />
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
