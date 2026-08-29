import type { RoomTypeSummary } from '@/lib/rooms';

/**
 * Live, pre-submit echo of `ReservationsService.assertWithinCapacity`
 * (roomick-pms-backend) — that check is the real enforcement (this is only
 * a UI convenience so a front-desk agent finds out immediately, not after
 * a failed submit). Adults/children checked independently, matching
 * `RoomType.capacity`'s own `{adults, children}` shape and the backend's
 * identical reasoning.
 */
export function CapacityWarning({ roomType, adults, childrenCount }: { roomType: RoomTypeSummary | undefined; adults: number | undefined; childrenCount: number | undefined }) {
  if (!roomType || adults === undefined) return null;
  const exceeds = adults > roomType.capacity.adults || (childrenCount ?? 0) > roomType.capacity.children;
  if (!exceeds) return null;

  return (
    <p className="text-small text-red-600">
      {roomType.name} sleeps up to {roomType.capacity.adults} adult(s) and {roomType.capacity.children} child(ren) — this exceeds capacity.
    </p>
  );
}
