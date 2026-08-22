/**
 * The backend models a room's operational state as THREE independent
 * columns (confirmed in roomick-pms-backend/prisma/schema.prisma):
 *
 *   OccupancyStatus   'vacant' | 'occupied'
 *   CleanlinessStatus 'dirty' | 'cleaning' | 'clean' | 'inspected'
 *   HeldStatus        'out_of_order' | 'blocked' | null   (null = not held)
 *
 * But the room-grid "glance view" the UI reference shows is ONE badge with
 * 5 possible colors (vacant/occupied/cleaning/out_of_order/blocked) — a
 * composite of all three columns, prioritized so a front-desk agent always
 * sees the single most operationally important fact about a room.
 *
 * This function is the ONE place that priority order lives. Duplicating it
 * ad hoc in every component that renders a room badge is exactly the "two
 * systems independently tracking the same fact, drifting apart" bug class
 * documented in the sibling five-clover-nestjs-backend project
 * (docs/LESSONS-LEARNED.md §4) — e.g. their room-status priority order was
 * once wrong in one of two places that computed it, and a stale hold
 * outranked a guest who was physically standing in the room. Import this
 * function everywhere a composite room-status color is needed; never
 * re-derive the priority order locally.
 *
 * If a future API response ever exposes a server-computed status field
 * directly, delete this helper and consume that field instead — a value
 * computed once on the server is safer than the same rule recomputed
 * independently on the client.
 */

export type OccupancyStatus = 'vacant' | 'occupied';
export type CleanlinessStatus = 'dirty' | 'cleaning' | 'clean' | 'inspected';
export type HeldStatus = 'out_of_order' | 'blocked' | null;

export type CompositeRoomStatus = 'vacant' | 'occupied' | 'cleaning' | 'out_of_order' | 'blocked';

export function deriveRoomStatus(
  occupancy: OccupancyStatus,
  cleanliness: CleanlinessStatus,
  held: HeldStatus,
): CompositeRoomStatus {
  // An administrative or maintenance hold always wins — it overrides
  // whatever occupancy/cleanliness would otherwise say.
  if (held) return held;

  // A room mid-turnover shows as "Cleaning" even if it's technically
  // vacant (nobody's checked in yet) or occupied (a stayover clean) — the
  // glance view cares that housekeeping is actively in the room right now.
  if (cleanliness === 'cleaning') return 'cleaning';

  return occupancy;
}
