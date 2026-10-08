'use client';

import { STATUS_STYLES } from '@/components/ui/StatusTag';
import type { CompositeRoomStatus } from '@/lib/deriveRoomStatus';

/** Every colour a room chip can take, in the order a desk reads the board: free, taken, being turned, and the two kinds of hold. */
const LEGEND: readonly CompositeRoomStatus[] = ['vacant', 'occupied', 'cleaning', 'out_of_order', 'blocked'];

/**
 * What the chip colours on the Room Status Board mean. The chips carry a
 * number only, so without this a new agent had to hover each one — or guess
 * which of teal, green and red was which. Reads the same `STATUS_STYLES` the
 * chips do, so the legend can't drift from the board.
 */
export function RoomStatusLegend() {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="What the colours mean">
      {LEGEND.map((status) => (
        <li key={status} className="flex items-center gap-2 text-small text-surface">
          <span aria-hidden="true" className={`inline-block size-3 rounded-sm ${STATUS_STYLES[status].className}`} />
          {STATUS_STYLES[status].label}
        </li>
      ))}
    </ul>
  );
}
