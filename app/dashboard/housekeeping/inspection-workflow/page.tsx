'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { InspectionIcon } from '@/components/ui/Icons';
import { useRoomsQuery, useChangeRoomStatusMutation } from '@/lib/rooms';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * Inspection Workflow (ref p30) — needs no new backend at all: `clean →
 * inspected` (Approve) and the drop-back-to-`dirty` transition (Reject)
 * both already exist on `RoomsService.changeStatus` from the Room Status
 * Board phase. Only supervisors (owner/manager) may approve — a
 * housekeeper hitting Approve gets the backend's own 403 surfaced plainly,
 * not silently hidden by disabling the button (this page doesn't know the
 * viewer's role client-side; the server is the actual authority).
 */
export default function InspectionWorkflowPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [actionError, setActionError] = useState<string | null>(null);
  const roomsQuery = useRoomsQuery(activeBranchId, auth);
  const changeStatusMutation = useChangeRoomStatusMutation(activeBranchId ?? '', auth);

  const awaitingInspection = useMemo(() => (roomsQuery.data ?? []).filter((r) => r.cleanlinessStatus === 'clean'), [roomsQuery.data]);

  if (!activeBranchId) return null;

  async function approve(roomId: string) {
    setActionError(null);
    try {
      await changeStatusMutation.mutateAsync({ roomId, cleanlinessStatus: 'inspected' });
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  async function reject(roomId: string) {
    setActionError(null);
    try {
      await changeStatusMutation.mutateAsync({ roomId, cleanlinessStatus: 'dirty' });
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Container className="max-w-5xl py-10 flex flex-col gap-6">
      <PageHeader icon={<InspectionIcon className="size-8" />} title="Inspection Workflow" subtitle="Supervisor approves cleaned rooms" />

      {actionError ? <p className="text-small text-red-600">{actionError}</p> : null}

      <Section label="Pending Inspections">
        {roomsQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading rooms…</p>
        ) : awaitingInspection.length === 0 ? (
          <p className="text-body text-primary-dark/70">Nothing awaiting inspection right now.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {awaitingInspection.map((room) => (
              <Card key={room.id} tone="secondary" className="flex flex-col gap-3">
                <span className="text-body font-bold text-secondary">Room {room.number}</span>
                <p className="text-small text-secondary-light border-b border-secondary/20 pb-2">Awaiting inspection by supervisor</p>
                <div className="flex gap-2">
                  <Button size="sm" loading={changeStatusMutation.isPending} onClick={() => approve(room.id)}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => reject(room.id)}>
                    Mark Dirty
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>
    </Container>
  );
}
