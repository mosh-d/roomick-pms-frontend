'use client';

import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { PageHeader } from '@/components/ui/PageHeader';
import { TaskBoardIcon, StaffAssignmentIcon, InspectionIcon, RoomBlockingIcon } from '@/components/ui/Icons';
import { useHousekeepingTasksQuery, useActiveBlocksQuery } from '@/lib/housekeeping';
import { useRoomsQuery } from '@/lib/rooms';
import { useAuthStore } from '@/lib/store/authStore';
import { HubCard } from '../_components/HubCard';

/**
 * Housekeeping hub (Roomick-UI.pdf p27) — all four cards are real. Unlike
 * Reservations' own hub (which had to leave Rate Plan Management inert),
 * everything the reference asks for here maps onto schema/service surface
 * that already existed or was built alongside this page: `HousekeepingTask`
 * for Task Board/Staff Assignment, the cleanliness ladder already built for
 * Room Status Board for Inspection Workflow, and `RoomBlock` for Room
 * Blocking/OOO.
 */
export default function HousekeepingHubPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const pendingTasksQuery = useHousekeepingTasksQuery(activeBranchId, { status: 'pending' }, auth);
  const myTasksQuery = useHousekeepingTasksQuery(activeBranchId, { assigneeId: user?.id }, auth);
  const roomsQuery = useRoomsQuery(activeBranchId, auth);
  const blocksQuery = useActiveBlocksQuery(activeBranchId, auth);

  if (!activeBranchId) return null;

  const readyForCleaning = pendingTasksQuery.data?.filter((t) => !t.assigneeId).length;
  const readyForInspection = roomsQuery.data?.filter((r) => r.cleanlinessStatus === 'clean').length;

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader title="Housekeeping" subtitle="Room cleaning workflow, staff assignments, and facility status." />

      <Section label="Housekeeping">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <HubCard
            icon={<TaskBoardIcon className="size-5" />}
            title="Task Board"
            description="My assigned rooms + status actions"
            stats={myTasksQuery.data ? [`${myTasksQuery.data.filter((t) => t.status !== 'done' && t.status !== 'skipped').length} assigned rooms`] : undefined}
            href="/dashboard/housekeeping/task-board"
          />
          <HubCard
            icon={<StaffAssignmentIcon className="size-5" />}
            title="Staff Assignment"
            description="Supervisor distributes rooms to housekeepers"
            stats={readyForCleaning !== undefined ? [`${readyForCleaning} rooms ready for cleaning`] : undefined}
            href="/dashboard/housekeeping/staff-assignment"
          />
          <HubCard
            icon={<InspectionIcon className="size-5" />}
            title="Inspection Workflow"
            description="Supervisor approves cleaned rooms"
            stats={readyForInspection !== undefined ? [`${readyForInspection} rooms ready for inspection`] : undefined}
            href="/dashboard/housekeeping/inspection-workflow"
          />
          <HubCard
            icon={<RoomBlockingIcon className="size-5" />}
            title="Room Blocking / OOO"
            description="Block rooms from inventory"
            stats={blocksQuery.data ? [`${blocksQuery.data.length} blocked rooms`] : undefined}
            href="/dashboard/housekeeping/room-blocking"
          />
        </div>
      </Section>
    </Container>
  );
}
