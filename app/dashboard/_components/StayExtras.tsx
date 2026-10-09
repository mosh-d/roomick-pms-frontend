'use client';

import { Card } from '@/components/ui/Card';
import { MultiSelectTagInput } from '@/components/ui/MultiSelectTagInput';
import { YesNoToggle } from '@/components/ui/YesNoToggle';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { BASIS_LABELS, usePackagesQuery } from '@/lib/packages';
import { useBookingOptionsQuery } from '@/lib/reservations';
import type { RoomTypeSummary } from '@/lib/rooms';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/** Day use on offer for this room type: the branch sells it and the type has a day-use rate. Null otherwise. */
export function useDayUseOffer(branchId: string | null, roomType: RoomTypeSummary | undefined, auth: AuthOpts): DayUseOffer | null {
  const options = useBookingOptionsQuery(branchId, auth);
  const hours = options.data?.dayUseHours ?? null;
  if (!hours || !roomType?.dayUseRate) return null;
  return { hours, rate: roomType.dayUseRate, symbol: currencySymbolFor(options.data?.currency) };
}

export type DayUseOffer = { hours: { from: string; until: string }; rate: string; symbol: string };

/** The Day Use switch — a room for the day, no night — shown only when it's on offer. */
export function DayUseField({
  offer,
  value,
  onChange,
}: {
  offer: DayUseOffer | null;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  if (!offer) return null;
  return <YesNoToggle label={`Day use — ${offer.hours.from} to ${offer.hours.until}, no night`} name="dayUse" value={value ? 'yes' : 'no'} onChange={(v) => onChange(v === 'yes')} />;
}

/** What a day-use stay comes to — the room type's day-use rate, before the tax a room charge carries. */
export function DayUsePreview({ offer }: { offer: DayUseOffer }) {
  return (
    <Card tone="accent" className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-small text-surface">
          The room for the day, {offer.hours.from} to {offer.hours.until}
        </span>
        <span className="text-body font-semibold text-surface">{formatMoney(offer.rate, offer.symbol)}</span>
      </div>
      <p className="text-tiny text-surface-muted">Before tax — it posts to the bill as one room charge at check-in. A per-night package counts the day as one night.</p>
    </Card>
  );
}

/** Packages sold with the stay — the active ones for this room type. Shown only when there are any. */
export function PackagesField({
  branchId,
  roomTypeId,
  value,
  onChange,
  auth,
}: {
  branchId: string | null;
  roomTypeId: string | null;
  value: string[];
  onChange: (value: string[]) => void;
  auth: AuthOpts;
}) {
  const packagesQuery = usePackagesQuery(branchId, auth);
  const symbol = currencySymbolFor(useBookingOptionsQuery(branchId, auth).data?.currency);
  if (!roomTypeId) return null;
  const offered = (packagesQuery.data ?? []).filter((p) => p.isActive && (p.roomTypeIds.length === 0 || p.roomTypeIds.includes(roomTypeId)));
  if (offered.length === 0) return null;
  return (
    <MultiSelectTagInput
      id="stay-packages"
      label="Packages (optional)"
      options={offered.map((p) => ({ value: p.id, label: `${p.name} — ${formatMoney(p.price, symbol)} ${BASIS_LABELS[p.basis]}` }))}
      value={value.filter((id) => offered.some((p) => p.id === id))}
      onChange={onChange}
      hint="Posted to the bill with the stay, each as its own charge."
    />
  );
}
