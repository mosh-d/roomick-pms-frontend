'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select, type SelectOption } from '@/components/ui/Select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { RoomBlockingIcon } from '@/components/ui/Icons';
import { useActiveBlocksQuery, useBlockRoomMutation, useUnblockRoomMutation, type RoomBlockRow } from '@/lib/housekeeping';
import { useRoomsQuery } from '@/lib/rooms';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';
import { formatDateOnly, hotelToday } from '@/lib/dates';

const REASON_OPTIONS: SelectOption[] = [
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'renovation', label: 'Renovation' },
  { value: 'vip_hold', label: 'VIP Hold' },
  { value: 'other', label: 'Other' },
];

/** Today at the hotel — the branch's calendar, not the device's. */
function todayString(): string {
  return hotelToday();
}

/**
 * Room Blocking / OOO (ref p31) — every block still in effect or still to
 * come, plus a form to create a new one. Ending a block that has started
 * frees the room from tonight and keeps the nights it held on record; one
 * that hasn't started yet is cancelled outright — see
 * `RoomsService.unblockRoom`'s own comment.
 */
export default function RoomBlockingPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const today = todayString();
  const [roomId, setRoomId] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [fromDate, setFromDate] = useState(today);
  const [toDate, setToDate] = useState(today);
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [ending, setEnding] = useState<RoomBlockRow | null>(null);

  const blocksQuery = useActiveBlocksQuery(activeBranchId, auth);
  const roomsQuery = useRoomsQuery(activeBranchId, auth);
  const blockMutation = useBlockRoomMutation(activeBranchId ?? '', auth);
  const unblockMutation = useUnblockRoomMutation(activeBranchId ?? '', auth);

  const roomOptions: SelectOption[] = useMemo(
    () => (roomsQuery.data ?? []).map((r) => ({ value: r.id, label: `${r.number} — ${r.roomType.name}` })),
    [roomsQuery.data],
  );

  if (!activeBranchId) return null;

  async function submitBlock() {
    if (!roomId || !reason) return;
    setFormError(null);
    try {
      await blockMutation.mutateAsync({ roomId, reason, fromDate, toDate, notes: notes || undefined });
      setRoomId(null);
      setReason(null);
      setFromDate(today);
      setToDate(today);
      setNotes('');
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  async function confirmEnd() {
    if (!ending) return;
    setFormError(null);
    try {
      await unblockMutation.mutateAsync(ending.id);
    } catch (error) {
      setFormError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    } finally {
      setEnding(null);
    }
  }

  /** A block starting today or later hasn't held a night yet: it's cancelled, not ended. */
  const notStarted = (block: RoomBlockRow) => block.fromDate.slice(0, 10) >= today;

  return (
    <Container className="max-w-5xl py-10 flex flex-col gap-8">
      <PageHeader icon={<RoomBlockingIcon className="size-8" />} title="Room Blocking / OOO" subtitle="Block rooms from inventory" />

      {formError ? <p className="text-small text-red-600">{formError}</p> : null}

      <Section label="Block a Room">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          <Select name="roomId" label="Room" options={roomOptions} value={roomId} onChange={setRoomId} />
          <Select name="reason" label="Reason" options={REASON_OPTIONS} value={reason} onChange={setReason} />
          <Input label="From Date" type="date" min={today} value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          <Input label="To Date" type="date" min={fromDate} value={toDate} onChange={(e) => setToDate(e.target.value)} />
        </div>
        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <Button type="button" disabled={!roomId || !reason} loading={blockMutation.isPending} onClick={submitBlock} className="self-start">
          Block Room
        </Button>
      </Section>

      <Section label="Blocked Rooms">
        {blocksQuery.isLoading ? (
          <p className="text-body text-surface-muted">Loading blocks…</p>
        ) : (blocksQuery.data ?? []).length === 0 ? (
          <p className="text-body text-surface-muted">No rooms are currently blocked.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {(blocksQuery.data ?? []).map((block) => (
              <Card key={block.id} tone="secondary" className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-body font-semibold text-surface">
                    Room {block.room.number} — <span className="capitalize">{block.reason.replace('_', ' ')}</span>
                  </p>
                  <p className="text-small text-surface-muted">
                    {formatDateOnly(block.fromDate)} – {formatDateOnly(block.toDate)}
                    {block.notes ? ` · ${block.notes}` : ''}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEnding(block)}>
                  {notStarted(block) ? 'Cancel Block' : 'End Block'}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <ConfirmDialog
        open={ending !== null}
        title={ending && notStarted(ending) ? 'Cancel this block?' : 'End this block?'}
        description={
          !ending
            ? ''
            : notStarted(ending)
              ? `Room ${ending.room.number} stays in inventory for ${formatDateOnly(ending.fromDate)} – ${formatDateOnly(ending.toDate)}. The block is removed; the audit trail keeps a record of it.`
              : `Room ${ending.room.number} is back in inventory from tonight — it can be sold and checked into today. The nights it was blocked stay on record.`
        }
        confirmLabel={ending && notStarted(ending) ? 'Cancel Block' : 'End Block'}
        cancelLabel="Keep It"
        loading={unblockMutation.isPending}
        onCancel={() => setEnding(null)}
        onConfirm={confirmEnd}
      />
    </Container>
  );
}
