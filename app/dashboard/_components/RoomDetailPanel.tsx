'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { StatusTag } from '@/components/ui/StatusTag';
import { ApiError } from '@/lib/api';
import { deriveRoomStatus, type CleanlinessStatus } from '@/lib/deriveRoomStatus';
import { floorLabel } from '@/lib/groupRoomsByFloor';
import { isSupervisorAtBranch } from '@/lib/roles';
import { useChangeRoomStatusMutation, type RoomWithDetails } from '@/lib/rooms';
import type { AuthUser } from '@/lib/store/authStore';

/**
 * Client mirror of `rooms.service.ts`'s `CLEANLINESS_TRANSITIONS` — same
 * accepted UX-only drift risk `lib/roles.ts` already documents (the
 * backend's own ladder check, `changeStatus`, is the real authority and
 * rejects an invalid transition regardless of what buttons this shows).
 */
const CLEANLINESS_TRANSITIONS: Record<CleanlinessStatus, CleanlinessStatus[]> = {
  dirty: ['cleaning'],
  cleaning: ['clean', 'dirty'],
  clean: ['inspected', 'dirty'],
  inspected: ['dirty'],
};

const CLEANLINESS_LABELS: Record<CleanlinessStatus, string> = {
  dirty: 'Mark Dirty',
  cleaning: 'Start Cleaning',
  clean: 'Mark Clean',
  inspected: 'Mark Inspected',
};

/**
 * Reference page 19's right-hand detail card — trimmed to what this
 * backend slice actually has. The reference also shows an "Occupied By"
 * guest card ("View Occupant's Folio", etc.) — that needs the
 * reservations/billing modules, which don't exist yet (see the plan's own
 * "backend build order" note), so it's left out rather than faked with
 * placeholder data.
 */
export function RoomDetailPanel({
  room,
  branchId,
  user,
  accessToken,
  tenantId,
}: {
  room: RoomWithDetails | null;
  branchId: string;
  user: AuthUser | null;
  accessToken: string | undefined;
  tenantId: string | undefined;
}) {
  const [actionError, setActionError] = useState<string | null>(null);
  const mutation = useChangeRoomStatusMutation(branchId, { accessToken, tenantId });

  if (!room) {
    return (
      <Card tone="secondary">
        <p className="text-body text-secondary-light">Select a room to see its details.</p>
      </Card>
    );
  }

  const status = deriveRoomStatus(room.occupancyStatus, room.cleanlinessStatus, room.heldStatus);
  const supervisor = isSupervisorAtBranch(user, branchId);
  const nextCleanlinessStates = CLEANLINESS_TRANSITIONS[room.cleanlinessStatus].filter(
    (next) => next !== 'inspected' || supervisor,
  );

  async function runAction(body: Parameters<typeof mutation.mutateAsync>[0]) {
    setActionError(null);
    try {
      await mutation.mutateAsync(body);
    } catch (error) {
      setActionError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Card tone="secondary" className="flex flex-col gap-3">
        <DetailRow label="Room Number" value={room.number} />
        <DetailRow label="Floor" value={floorLabel(room.floor.floorNumber, room.floor.label)} />
        <DetailRow label="Room Type" value={room.roomType.name} />
        {room.view ? <DetailRow label="View" value={room.view} /> : null}
        <div className="flex items-center justify-between gap-2">
          <span className="text-small font-semibold text-secondary">Status</span>
          <StatusTag value={status} />
        </div>
        {room.notes ? (
          <div className="flex flex-col gap-1 pt-2 border-t border-secondary/20">
            <span className="text-small font-semibold text-secondary">Notes</span>
            <p className="text-small text-secondary-light">{room.notes}</p>
          </div>
        ) : null}
      </Card>

      <Card tone="secondary" className="flex flex-col gap-3">
        <h3 className="text-small font-bold text-secondary-light">Housekeeping</h3>
        <div className="flex flex-wrap gap-2">
          {nextCleanlinessStates.map((next) => (
            <Button
              key={next}
              size="sm"
              variant="outline"
              disabled={mutation.isPending}
              onClick={() => runAction({ roomId: room.id, cleanlinessStatus: next })}
            >
              {CLEANLINESS_LABELS[next]}
            </Button>
          ))}
        </div>

        {supervisor ? (
          <>
            <h3 className="text-small font-bold text-secondary-light pt-2 border-t border-secondary/20">
              Occupancy Correction
            </h3>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={mutation.isPending || room.occupancyStatus === 'vacant'}
                onClick={() => runAction({ roomId: room.id, occupancyStatus: 'vacant' })}
              >
                Mark Vacant
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={mutation.isPending || room.occupancyStatus === 'occupied'}
                onClick={() => runAction({ roomId: room.id, occupancyStatus: 'occupied' })}
              >
                Mark Occupied
              </Button>
            </div>

            <h3 className="text-small font-bold text-secondary-light pt-2 border-t border-secondary/20">Hold</h3>
            <div className="flex flex-wrap gap-2">
              {room.heldStatus ? (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={mutation.isPending}
                  onClick={() => runAction({ roomId: room.id, heldStatus: null })}
                >
                  Release Hold
                </Button>
              ) : (
                <>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={mutation.isPending}
                    onClick={() => runAction({ roomId: room.id, heldStatus: 'out_of_order' })}
                  >
                    Out of Order
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={mutation.isPending}
                    onClick={() => runAction({ roomId: room.id, heldStatus: 'blocked' })}
                  >
                    Block
                  </Button>
                </>
              )}
            </div>
          </>
        ) : null}

        {actionError ? <p className="text-small text-red-600">{actionError}</p> : null}
      </Card>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-small font-semibold text-secondary">{label}</span>
      <span className="text-small text-secondary-light">{value}</span>
    </div>
  );
}
