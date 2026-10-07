import { StatusTag } from '@/components/ui/StatusTag';

/** A guest's name with the VIP badge (ref: Arrivals / In-House "VIP badge") when their profile has a VIP level. */
export function GuestNameCell({ guest }: { guest: { name: string; vipLevel?: number | null } }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      {guest.name}
      {guest.vipLevel ? (
        <span title={`VIP level ${guest.vipLevel}`}>
          <StatusTag value="vip" />
        </span>
      ) : null}
    </span>
  );
}
