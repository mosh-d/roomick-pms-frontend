'use client';

import { STATUS_STYLES } from '@/components/ui/StatusTag';
import { deriveRoomStatus } from '@/lib/deriveRoomStatus';
import type { RoomWithDetails } from '@/lib/rooms';

/**
 * One room chip in the grid — reference page 19 shows a dense grid of
 * number-only, solid-fill chips (not the full pill-shaped `StatusTag`,
 * which is sized for inline prose). Reuses `STATUS_STYLES` for the fill
 * color only, so a status's color can never drift between this chip and
 * the pill badge shown in `RoomDetailPanel`.
 *
 * The selected chip gets a `ring-primary` outline, matching the reference's
 * gold-outlined "112" cell.
 */
export function RoomCell({
  room,
  selected,
  onSelect,
}: {
  room: RoomWithDetails;
  selected: boolean;
  onSelect: (roomId: string) => void;
}) {
  const status = deriveRoomStatus(room.occupancyStatus, room.cleanlinessStatus, room.heldStatus);
  const { className } = STATUS_STYLES[status];

  return (
    <button
      type="button"
      onClick={() => onSelect(room.id)}
      aria-pressed={selected}
      title={`${room.number} — ${STATUS_STYLES[status].label}`}
      className={`inline-flex items-center justify-center min-w-14 h-10 px-2 rounded-control text-small font-semibold text-white cursor-pointer transition-[filter,box-shadow] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${className} ${
        selected ? 'ring-2 ring-primary ring-offset-2' : ''
      }`}
    >
      {room.number}
    </button>
  );
}
