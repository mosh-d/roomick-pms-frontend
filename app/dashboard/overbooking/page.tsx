'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { YesNoToggle } from '@/components/ui/YesNoToggle';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { OverbookingIcon } from '@/components/ui/Icons';
import { useOverbookingConfigsQuery, useUpdateOverbookingConfigMutation, useOverbookingExposureQuery, useWalkReservationMutation } from '@/lib/overbooking';
import { useReservationsQuery } from '@/lib/reservations';
import { useRoomTypesQuery } from '@/lib/rooms';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function currentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Green when comfortably under capacity, amber once the alert threshold is crossed, red once actually overbooked — same three-way read Availability Calendar's own `availabilityTone` uses, inverted (here more reserved is the risk signal, not less available). */
function exposureTone(night: { isOverbooked: boolean; isAlerting: boolean }): string {
  if (night.isOverbooked) return 'bg-red-100 text-red-700';
  if (night.isAlerting) return 'bg-amber-100 text-amber-800';
  return 'bg-green-50 text-green-700';
}

/**
 * Overbooking Management (ref: MVP timeline Month 4) — no page exists for
 * this in the reference UI mockup itself (checked the full PDF; it's a
 * spec-only module with no visual design to match), so this page's own
 * layout is this project's, not a reference reproduction. Three real
 * pieces: the config (branch-wide + optional per-room-type overrides,
 * already partly built — `PropertyService.updateOverbookingConfig`
 * predates this phase), the exposure heatmap (a genuinely new read), and
 * the walk flow (relocate a guest, auto-cancel, refund whatever was
 * actually paid).
 */
export default function OverbookingManagementPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [{ year, month }, setYearMonth] = useState(currentYearMonth);
  const [walkReservationId, setWalkReservationId] = useState<string | null>(null);
  const [relocationProperty, setRelocationProperty] = useState('');
  const [transportProvided, setTransportProvided] = useState<'yes' | 'no'>('no');
  const [transportCost, setTransportCost] = useState('');
  const [compensationOffered, setCompensationOffered] = useState('');
  const [walkError, setWalkError] = useState<string | null>(null);
  const [walkResult, setWalkResult] = useState<string | null>(null);

  const configsQuery = useOverbookingConfigsQuery(activeBranchId, auth);
  const roomTypesQuery = useRoomTypesQuery(activeBranchId, auth);
  const exposureQuery = useOverbookingExposureQuery(activeBranchId, year, month, auth);
  const confirmedQuery = useReservationsQuery(activeBranchId, { status: 'confirmed' }, auth);
  const walkMutation = useWalkReservationMutation(activeBranchId ?? '', auth);

  const roomTypeNameById = useMemo(() => new Map((roomTypesQuery.data ?? []).map((rt) => [rt.id, rt.name])), [roomTypesQuery.data]);
  const reservationOptions: SelectOption[] = useMemo(
    () => (confirmedQuery.data ?? []).map((r) => ({ value: r.id, label: `${r.guest.name} — ${r.roomType.name} (${r.confirmationNumber})` })),
    [confirmedQuery.data],
  );
  const yearOptions: SelectOption[] = [0, 1, 2].map((offset) => {
    const y = currentYearMonth().year + offset;
    return { value: String(y), label: String(y) };
  });
  const monthOptions: SelectOption[] = MONTHS.map((name, i) => ({ value: String(i + 1), label: name }));

  if (!activeBranchId) return null;

  async function submitWalk() {
    if (!walkReservationId || !relocationProperty.trim()) return;
    setWalkError(null);
    setWalkResult(null);
    try {
      const result = await walkMutation.mutateAsync({
        reservationId: walkReservationId,
        relocationProperty: relocationProperty.trim(),
        transportProvided: transportProvided === 'yes',
        transportCost: transportCost ? Number(transportCost) : undefined,
        compensationOffered: compensationOffered.trim() || undefined,
      });
      setWalkResult(
        Number(result.refundedTotal) > 0
          ? `${result.reservation.guest.name} walked to ${relocationProperty}. Refunded ${result.refundedTotal}.`
          : `${result.reservation.guest.name} walked to ${relocationProperty}. Nothing had been paid yet, so nothing to refund.`,
      );
      setWalkReservationId(null);
      setRelocationProperty('');
      setTransportProvided('no');
      setTransportCost('');
      setCompensationOffered('');
    } catch (error) {
      setWalkError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  const exposureRoomTypes = exposureQuery.data?.roomTypes ?? [];
  const exposureDates = exposureRoomTypes[0]?.nights.map((n) => n.date) ?? [];

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader icon={<OverbookingIcon className="size-8" />} title="Overbooking Management" subtitle="Thresholds, walk flow, exposure" />

      <Section label="Configuration">
        <ConfigForm branchId={activeBranchId} roomTypeOptions={(roomTypesQuery.data ?? []).map((rt) => ({ value: rt.id, label: rt.name }))} auth={auth} />
        {configsQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading…</p>
        ) : (configsQuery.data ?? []).length === 0 ? (
          <p className="text-body text-primary-dark/70">No overbooking config yet — every room type hard-blocks at physical capacity.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {(configsQuery.data ?? []).map((config) => (
              <Card key={config.id} tone="secondary" className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-body font-semibold text-secondary">{config.roomTypeId ? (roomTypeNameById.get(config.roomTypeId) ?? 'Unknown Room Type') : 'All Room Types'}</p>
                  <p className="text-small text-secondary-light">
                    {config.globalEnabled ? `Enabled — up to ${config.maxOverbookPct ?? 0}% over capacity` : 'Disabled — hard block at capacity'}
                    {config.alertAtPct ? `, alert at ${config.alertAtPct}%` : ''}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section label="Exposure">
        <div className="flex flex-wrap gap-4 max-w-md">
          <div className="w-40">
            <Select id="exposure-year" name="year" label="Year" options={yearOptions} value={String(year)} onChange={(v) => setYearMonth({ year: Number(v), month })} />
          </div>
          <div className="w-40">
            <Select id="exposure-month" name="month" label="Month" options={monthOptions} value={String(month)} onChange={(v) => setYearMonth({ year, month: Number(v) })} />
          </div>
        </div>

        {exposureQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading…</p>
        ) : exposureRoomTypes.length === 0 ? (
          <p className="text-body text-primary-dark/70">No room types are set up at this branch yet.</p>
        ) : (
          <Card tone="secondary" className="overflow-x-auto">
            <table className="border-collapse">
              <thead>
                <tr>
                  <th className="sticky left-0 bg-secondary/5 text-small font-bold text-secondary text-left py-2 pr-4 pl-1 whitespace-nowrap">Room Type</th>
                  {exposureDates.map((date) => (
                    <th key={date} className="text-tiny font-semibold text-secondary-light text-center py-2 px-1 whitespace-nowrap">
                      {new Date(date).getDate()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {exposureRoomTypes.map((rt) => (
                  <tr key={rt.roomTypeId} className="border-t border-secondary/10">
                    <td className="sticky left-0 bg-secondary/5 text-small font-semibold text-secondary py-2 pr-4 pl-1 whitespace-nowrap">{rt.roomTypeName}</td>
                    {rt.nights.map((night) => (
                      <td key={night.date} className="text-center py-1 px-1">
                        <span
                          className={`inline-flex items-center justify-center size-7 rounded-control text-tiny font-semibold ${exposureTone(night)}`}
                          title={`${night.reservedCount} reserved of ${night.physicalPool} physical (ceiling ${night.ceilingCapacity}) on ${night.date}`}
                        >
                          {night.reservedCount}
                        </span>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </Section>

      <Section label="Walk a Reservation">
        {walkResult ? <p className="text-small text-primary-dark">{walkResult}</p> : null}
        {confirmedQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading…</p>
        ) : reservationOptions.length === 0 ? (
          <p className="text-body text-primary-dark/70">No confirmed reservations to walk right now.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
              <Select name="reservationId" label="Reservation" options={reservationOptions} value={walkReservationId} onChange={setWalkReservationId} />
              <Input name="relocationProperty" label="Relocation Property" value={relocationProperty} onChange={(e) => setRelocationProperty(e.target.value)} placeholder="Sister Hotel Downtown" />
              <Input name="transportCost" label="Transport Cost" type="number" min={0} value={transportCost} onChange={(e) => setTransportCost(e.target.value)} />
              <YesNoToggle label="Transport Provided" name="transportProvided" value={transportProvided} onChange={setTransportProvided} />
            </div>
            <Input name="compensationOffered" label="Compensation Offered" value={compensationOffered} onChange={(e) => setCompensationOffered(e.target.value)} placeholder="One free night + breakfast on next stay" />
            {walkError ? <p className="text-small text-red-600">{walkError}</p> : null}
            <Button type="button" variant="danger" disabled={!walkReservationId || !relocationProperty.trim()} loading={walkMutation.isPending} onClick={submitWalk} className="self-start">
              Walk Guest
            </Button>
          </>
        )}
      </Section>
    </Container>
  );
}

function ConfigForm({
  branchId,
  roomTypeOptions,
  auth,
}: {
  branchId: string;
  roomTypeOptions: SelectOption[];
  auth: { accessToken: string | undefined; tenantId: string | undefined };
}) {
  const [roomTypeId, setRoomTypeId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<'yes' | 'no'>('no');
  const [maxOverbookPct, setMaxOverbookPct] = useState('');
  const [alertAtPct, setAlertAtPct] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const mutation = useUpdateOverbookingConfigMutation(branchId, auth);

  async function save() {
    setError(null);
    setSaved(false);
    try {
      await mutation.mutateAsync({
        roomTypeId: roomTypeId ?? undefined,
        globalEnabled: enabled === 'yes',
        maxOverbookPct: maxOverbookPct ? Number(maxOverbookPct) : undefined,
        alertAtPct: alertAtPct ? Number(alertAtPct) : undefined,
        validFrom: validFrom || undefined,
        validTo: validTo || undefined,
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  const options: SelectOption[] = [{ value: '', label: 'All Room Types' }, ...roomTypeOptions];

  return (
    <div className="flex flex-col gap-2 mb-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        <Select name="roomTypeId" label="Room Type" options={options} value={roomTypeId} onChange={setRoomTypeId} />
        <YesNoToggle label="Overbooking Enabled" name="globalEnabled" value={enabled} onChange={setEnabled} />
        <Input name="maxOverbookPct" label="Max Overbook %" type="number" min={0} max={100} value={maxOverbookPct} onChange={(e) => setMaxOverbookPct(e.target.value)} placeholder="10" />
        <Input name="alertAtPct" label="Alert At %" type="number" min={0} max={100} value={alertAtPct} onChange={(e) => setAlertAtPct(e.target.value)} placeholder="80" />
        <Input name="validFrom" label="Valid From" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
        <Input name="validTo" label="Valid To" type="date" min={validFrom || undefined} value={validTo} onChange={(e) => setValidTo(e.target.value)} />
      </div>
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {saved ? <p className="text-small text-primary-dark">Saved.</p> : null}
      <Button type="button" loading={mutation.isPending} onClick={save} className="self-start">
        Save Config
      </Button>
    </div>
  );
}
