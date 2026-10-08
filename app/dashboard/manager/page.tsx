'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReportsIcon, StaffAssignmentIcon } from '@/components/ui/Icons';
import { STATUS_STYLES } from '@/components/ui/StatusTag';
import { useOccupancyReportQuery, useAdrReportQuery } from '@/lib/reports';
import { useArrivalsQuery, useDeparturesQuery, useInHouseQuery, useReservationsQuery, useSetRateOverrideMutation, type ReservationSummary } from '@/lib/reservations';
import { useFoliosQuery } from '@/lib/folios';
import { useAlertsQuery } from '@/lib/alerts';
import { useRoomsQuery } from '@/lib/rooms';
import { deriveRoomStatus } from '@/lib/deriveRoomStatus';
import { useStaffQuery } from '@/lib/staff';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { ApiError } from '@/lib/api';
import { HubCard } from '../_components/HubCard';
import { useAuthStore } from '@/lib/store/authStore';
import { addDays, todayLocal } from '@/lib/dates';

// The viewer's own calendar day, not the UTC date — which in Lagos is still
// yesterday until one in the morning, so "today's" figures were a day out.
function today(): string {
  return todayLocal();
}
function tomorrow(): string {
  return addDays(todayLocal(), 1);
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card tone="accent" className="flex-1 min-w-40">
      <p className="text-tiny text-surface-muted">{label}</p>
      <p className="text-header font-bold text-surface">{value}</p>
    </Card>
  );
}

/**
 * The reference's "real-time room status mini-map" — a compact dot grid,
 * not the full interactive `RoomGrid` (that already exists at
 * `/dashboard/room-status-board`; this is a glance-only echo of it, same
 * composite-status colors via `STATUS_STYLES`, no click actions).
 */
function RoomStatusMiniMap({ rooms }: { rooms: Array<{ id: string; number: string; occupancyStatus: 'vacant' | 'occupied'; cleanlinessStatus: 'dirty' | 'cleaning' | 'clean' | 'inspected'; heldStatus: 'out_of_order' | 'blocked' | null }> }) {
  if (rooms.length === 0) return <p className="text-small text-surface-muted">No rooms configured yet.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {rooms.map((room) => {
        const status = deriveRoomStatus(room.occupancyStatus, room.cleanlinessStatus, room.heldStatus);
        return (
          <div
            key={room.id}
            title={`Room ${room.number} — ${STATUS_STYLES[status].label}`}
            className={`size-4 rounded-sm ${STATUS_STYLES[status].className}`}
          />
        );
      })}
    </div>
  );
}

function RateOverrideSection({ branchId, auth }: { branchId: string; auth: { accessToken: string | undefined; tenantId: string | undefined } }) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ReservationSummary | null>(null);
  const [overrideRate, setOverrideRate] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const searchQuery = useReservationsQuery(branchId, { search }, auth, search.trim().length > 0);
  const overrideMutation = useSetRateOverrideMutation(branchId, auth);

  const nights = selected ? Math.max(1, Math.round((new Date(selected.checkOutDate).getTime() - new Date(selected.checkInDate).getTime()) / 86_400_000)) : 0;
  const currentNightlyRate = selected ? Number(selected.confirmedRate) / nights : 0;

  async function handleSubmit() {
    if (!selected || !overrideRate || !reason) return;
    setError(null);
    setSuccess(false);
    try {
      await overrideMutation.mutateAsync({ reservationId: selected.id, overrideRate: Number(overrideRate), reason });
      setSuccess(true);
      setOverrideRate('');
      setReason('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Section label="Rate Override">
      <div className="flex flex-col gap-4">
        {!selected ? (
          <>
            <Input label="Find a reservation" placeholder="Guest name or confirmation number" value={search} onChange={(e) => setSearch(e.target.value)} />
            {search.trim() && (
              <Card tone="secondary" className="flex flex-col gap-2 max-h-64 overflow-y-auto">
                {(searchQuery.data ?? []).length === 0 ? (
                  <p className="text-small text-surface-muted">No matching reservations.</p>
                ) : (
                  (searchQuery.data ?? []).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSelected(r);
                        setSearch('');
                        setError(null);
                        setSuccess(false);
                      }}
                      className="text-left rounded-control px-2 py-1.5 hover:bg-secondary-light/20"
                    >
                      <span className="font-semibold text-surface">{r.guest.name}</span> — {r.confirmationNumber} ({r.roomType.name}, {r.status})
                    </button>
                  ))
                )}
              </Card>
            )}
          </>
        ) : (
          <Card tone="accent" className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-surface">{selected.guest.name}</p>
                <p className="text-small text-surface-muted">
                  {selected.confirmationNumber} — {selected.roomType.name}, {nights} night(s), current nightly rate {formatMoney(currentNightlyRate, currencySymbolFor(selected.branch.currency))}
                </p>
              </div>
              <Button size="sm" variant="outline" onClick={() => setSelected(null)}>
                Change reservation
              </Button>
            </div>

            <Input
              id="rate-override-amount"
              label="New nightly rate"
              type="number"
              min={0}
              step="0.01"
              prefix={currencySymbolFor(selected.branch.currency)}
              value={overrideRate}
              onChange={(e) => setOverrideRate(e.target.value)}
              hint="Applies to every night not yet posted to the folio — already-posted charges are untouched."
            />
            <Input id="rate-override-reason" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} error={error ?? undefined} hint="Required — written to the audit trail." />
            {success ? <p className="text-small text-green-700">Rate override saved.</p> : null}
            <div>
              <Button type="button" onClick={handleSubmit} disabled={overrideMutation.isPending || !overrideRate || !reason}>
                {overrideMutation.isPending ? 'Saving…' : 'Save Override'}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </Section>
  );
}

/**
 * Manager Dashboard (pms-frontend-structure-2.html's own `page-manager`) —
 * the first of the 11 Management/Admin gaps this project's own sidebar
 * restructuring surfaced as honest placeholders. Picked first because it
 * needed zero new backend models: "Operations Overview" is pure
 * composition of report/alerts/reservation hooks that already existed,
 * and "Staff Management" — its own page now, with Page Access — wraps staff
 * endpoints that shipped in P1 with no frontend surface until then. "Rate Override" is the one genuinely new
 * backend piece — `overrideRate`/`overrideReason` columns existed since P0
 * but nothing ever wrote them.
 */
export default function ManagerDashboardPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const range = useMemo(() => ({ from: today(), to: tomorrow() }), []);
  const occupancyQuery = useOccupancyReportQuery(activeBranchId, range, auth);
  const adrQuery = useAdrReportQuery(activeBranchId, range, auth);
  const arrivalsQuery = useArrivalsQuery(activeBranchId, undefined, auth);
  const departuresQuery = useDeparturesQuery(activeBranchId, undefined, auth);
  const inHouseQuery = useInHouseQuery(activeBranchId, auth);
  const outstandingQuery = useFoliosQuery(activeBranchId, 'outstanding', auth);
  const alertsQuery = useAlertsQuery(activeBranchId, auth);
  const roomsQuery = useRoomsQuery(activeBranchId, auth);
  const staffQuery = useStaffQuery(activeBranchId, auth);

  const dirtyRoomsCount = (roomsQuery.data ?? []).filter((r) => r.cleanlinessStatus === 'dirty').length;
  const outstandingTotal = (outstandingQuery.data ?? []).reduce((sum, f) => sum + Number(f.balanceDue), 0);
  const outstandingCurrency = outstandingQuery.data?.[0]?.currency;

  if (!activeBranchId) return null;

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader
        icon={<ReportsIcon className="size-8" />}
        title="Manager Dashboard"
        subtitle="Operational oversight, approvals, staff management, override controls."
        roles="Manager"
      />

      <Section label="Operations Overview">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-4">
            <KpiCard label="Occupancy Today" value={occupancyQuery.data ? `${occupancyQuery.data.summary.occupancyPct}%` : '—'} />
            <KpiCard label="ADR Today" value={adrQuery.data ? formatMoney(adrQuery.data.summary.adr, currencySymbolFor(adrQuery.data.currency)) : '—'} />
            <KpiCard label="Rooms Dirty" value={roomsQuery.data ? String(dirtyRoomsCount) : '—'} />
            <KpiCard label="Arrivals Today" value={arrivalsQuery.data ? String(arrivalsQuery.data.length) : '—'} />
            <KpiCard label="Departures Today" value={departuresQuery.data ? String(departuresQuery.data.length) : '—'} />
            <KpiCard label="In-House Guests" value={inHouseQuery.data ? String(inHouseQuery.data.length) : '—'} />
            <KpiCard label="Outstanding Balances" value={outstandingQuery.data ? formatMoney(outstandingTotal, currencySymbolFor(outstandingCurrency)) : '—'} />
            <KpiCard label="Alerts Needing Attention" value={alertsQuery.data ? String(alertsQuery.data.total) : '—'} />
          </div>
          <p className="text-tiny text-surface-muted">
            &quot;Alerts Needing Attention&quot; covers missed check-ins, overdue checkouts, overdue balances, and urgent maintenance — urgent work orders and rooms out of service.
          </p>
          <div>
            <p className="text-small font-semibold text-surface/80 mb-2">Room Status</p>
            <RoomStatusMiniMap rooms={roomsQuery.data ?? []} />
          </div>
        </div>
      </Section>

      <RateOverrideSection branchId={activeBranchId} auth={auth} />

      <Section label="Staff Management">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <HubCard
            icon={<StaffAssignmentIcon className="size-5" />}
            title="Staff Management"
            description="Invite and deactivate staff, and choose which pages each staff role opens here"
            stats={staffQuery.data ? [`${staffQuery.data.length} ${staffQuery.data.length === 1 ? 'person' : 'people'} at this branch`] : undefined}
            href="/dashboard/manager/staff"
          />
        </div>
      </Section>
    </Container>
  );
}
