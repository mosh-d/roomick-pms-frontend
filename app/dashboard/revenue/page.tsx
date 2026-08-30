'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { CompSetAnalysisIcon } from '@/components/ui/Icons';
import { HubCard } from '../_components/HubCard';
import {
  useAvailabilityRestrictionsQuery,
  useCreateAvailabilityRestrictionMutation,
  useDeleteAvailabilityRestrictionMutation,
  useDemandForecastQuery,
  useRateRecommendationsQuery,
  useApproveRateRecommendationMutation,
} from '@/lib/revenueManagement';
import { useRoomTypesQuery } from '@/lib/rooms';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

const FORECAST_HORIZON_DAYS = 14;
const ALL_ROOM_TYPES_VALUE = '';

/**
 * Revenue Management (ref p18) — the last of the architecture map's own
 * named gaps. The reference labels Demand Forecast "AI-based" and Rate
 * Recommendations "AI-suggested"; this app has no ML/forecasting
 * infrastructure anywhere, so neither section claims that. Both are real:
 * a same-weekday historical average (`DemandForecastService`) and fixed-
 * threshold rules built on top of it (`RateRecommendationsService`) —
 * genuinely useful, honestly labeled. Approving a recommendation creates a
 * real `seasonal` `RatePlan` through the same `RateResolverService` every
 * other rate plan on this app already goes through. Comp Set Analysis
 * stays inert — it needs a real external competitor-rate data source this
 * pass doesn't build.
 */
export default function RevenueManagementPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  if (!activeBranchId) return null;

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader title="Revenue Management" subtitle="Demand forecasting, yield management, rate optimization, comp set analysis." roles="Revenue Manager" />

      <RestrictionsSection branchId={activeBranchId} auth={auth} />
      <DemandForecastSection branchId={activeBranchId} auth={auth} />
      <RateRecommendationsSection branchId={activeBranchId} auth={auth} />

      <Section label="Comp Set Analysis">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <HubCard icon={<CompSetAnalysisIcon className="size-5" />} title="Comp Set Analysis" description="Competitor rates, parity alerts" />
        </div>
        <p className="text-small text-primary-dark/70">
          Not built — this needs a real external competitor-rate data source (a rate-shopping feed or manual entry pipeline), separate scope from this pass. No fabricated competitor data is shown here.
        </p>
      </Section>
    </Container>
  );
}

function RestrictionsSection({ branchId, auth }: { branchId: string; auth: AuthOpts }) {
  const restrictionsQuery = useAvailabilityRestrictionsQuery(branchId, auth);
  const roomTypesQuery = useRoomTypesQuery(branchId, auth);
  const createMutation = useCreateAvailabilityRestrictionMutation(branchId, auth);
  const deleteMutation = useDeleteAvailabilityRestrictionMutation(branchId, auth);

  const [roomTypeId, setRoomTypeId] = useState(ALL_ROOM_TYPES_VALUE);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minLOS, setMinLOS] = useState('');
  const [maxLOS, setMaxLOS] = useState('');
  const [closedToArrival, setClosedToArrival] = useState(false);
  const [stopSell, setStopSell] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roomTypeOptions = useMemo(
    () => [{ value: ALL_ROOM_TYPES_VALUE, label: 'All room types' }, ...(roomTypesQuery.data ?? []).map((rt) => ({ value: rt.id, label: rt.name }))],
    [roomTypesQuery.data],
  );
  const roomTypeNameById = useMemo(() => new Map((roomTypesQuery.data ?? []).map((rt) => [rt.id, rt.name])), [roomTypesQuery.data]);

  async function create() {
    if (!startDate || !endDate) return;
    setError(null);
    try {
      await createMutation.mutateAsync({
        roomTypeId: roomTypeId || undefined,
        startDate,
        endDate,
        minLOS: minLOS ? Number(minLOS) : undefined,
        maxLOS: maxLOS ? Number(maxLOS) : undefined,
        closedToArrival,
        stopSell,
      });
      setRoomTypeId(ALL_ROOM_TYPES_VALUE);
      setStartDate('');
      setEndDate('');
      setMinLOS('');
      setMaxLOS('');
      setClosedToArrival(false);
      setStopSell(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Section label="Restrictions Management">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 max-w-3xl">
        <Select id="restriction-room-type" label="Room Type" options={roomTypeOptions} value={roomTypeId} onChange={setRoomTypeId} />
        <Input id="restriction-start-date" label="Start Date" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Input id="restriction-end-date" label="End Date (exclusive)" type="date" min={startDate || undefined} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <Input id="restriction-min-los" label="Min LOS (nights, optional)" type="number" min={1} value={minLOS} onChange={(e) => setMinLOS(e.target.value)} />
        <Input id="restriction-max-los" label="Max LOS (nights, optional)" type="number" min={1} value={maxLOS} onChange={(e) => setMaxLOS(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-small text-secondary">
          <input type="checkbox" checked={closedToArrival} onChange={(e) => setClosedToArrival(e.target.checked)} />
          Closed to arrival
        </label>
        <label className="flex items-center gap-2 text-small text-secondary">
          <input type="checkbox" checked={stopSell} onChange={(e) => setStopSell(e.target.checked)} />
          Stop-sell (no bookings at all)
        </label>
      </div>
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div>
        <Button type="button" onClick={create} loading={createMutation.isPending} disabled={!startDate || !endDate}>
          Add Restriction
        </Button>
      </div>

      {restrictionsQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading…</p>
      ) : (restrictionsQuery.data ?? []).length === 0 ? (
        <p className="text-body text-primary-dark/70">No restrictions configured — every booking is currently unrestricted.</p>
      ) : (
        <Card tone="secondary" className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-small font-bold text-secondary text-left">
                <th className="py-2 pr-4">Room Type</th>
                <th className="py-2 pr-4">Dates</th>
                <th className="py-2 pr-4">Min LOS</th>
                <th className="py-2 pr-4">Max LOS</th>
                <th className="py-2 pr-4">CTA</th>
                <th className="py-2 pr-4">Stop-Sell</th>
                <th className="py-2 pr-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {(restrictionsQuery.data ?? []).map((r) => (
                <tr key={r.id} className="border-t border-secondary/10 text-small text-secondary">
                  <td className="py-2 pr-4">{r.roomTypeId ? (r.roomTypeName ?? roomTypeNameById.get(r.roomTypeId) ?? 'Unknown') : 'All room types'}</td>
                  <td className="py-2 pr-4">
                    {new Date(r.startDate).toLocaleDateString()} – {new Date(r.endDate).toLocaleDateString()}
                  </td>
                  <td className="py-2 pr-4">{r.minLOS ?? '—'}</td>
                  <td className="py-2 pr-4">{r.maxLOS ?? '—'}</td>
                  <td className="py-2 pr-4">{r.closedToArrival ? 'Yes' : '—'}</td>
                  <td className="py-2 pr-4">{r.stopSell ? 'Yes' : '—'}</td>
                  <td className="py-2 pr-4">
                    <Button size="sm" variant="outline" loading={deleteMutation.isPending} onClick={() => deleteMutation.mutate(r.id)}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </Section>
  );
}

function DemandForecastSection({ branchId, auth }: { branchId: string; auth: AuthOpts }) {
  const forecastQuery = useDemandForecastQuery(branchId, FORECAST_HORIZON_DAYS, auth);

  return (
    <Section label="Demand Forecast">
      <p className="text-small text-primary-dark/70">
        Same-weekday historical occupancy average over the trailing 8 weeks, projected forward — not a predictive model. A blank forecast means there isn&rsquo;t enough history for that weekday yet.
      </p>
      {forecastQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading…</p>
      ) : (
        <Card tone="secondary" className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-small font-bold text-secondary text-left">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Day</th>
                <th className="py-2 pr-4">Forecast Occupancy</th>
                <th className="py-2 pr-4">Sample Size</th>
              </tr>
            </thead>
            <tbody>
              {(forecastQuery.data ?? []).map((day) => (
                <tr key={day.date} className="border-t border-secondary/10 text-small text-secondary">
                  <td className="py-2 pr-4">{new Date(`${day.date}T00:00:00.000Z`).toLocaleDateString()}</td>
                  <td className="py-2 pr-4">{day.dayOfWeek}</td>
                  <td className="py-2 pr-4">{day.forecastOccupancyPct !== null ? `${day.forecastOccupancyPct}%` : '—'}</td>
                  <td className="py-2 pr-4">{day.historicalSampleSize} weeks</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </Section>
  );
}

function RateRecommendationsSection({ branchId, auth }: { branchId: string; auth: AuthOpts }) {
  const roomTypesQuery = useRoomTypesQuery(branchId, auth);
  const [roomTypeId, setRoomTypeId] = useState<string | null>(null);
  const recommendationsQuery = useRateRecommendationsQuery(branchId, roomTypeId, auth);
  const approveMutation = useApproveRateRecommendationMutation(branchId, roomTypeId, auth);
  const [approvingDate, setApprovingDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const roomTypeOptions = useMemo(() => (roomTypesQuery.data ?? []).map((rt) => ({ value: rt.id, label: rt.name })), [roomTypesQuery.data]);

  async function approve(date: string, adjustmentPct: number) {
    if (!roomTypeId) return;
    setError(null);
    setApprovingDate(date);
    try {
      await approveMutation.mutateAsync({ roomTypeId, date, adjustmentPct });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setApprovingDate(null);
    }
  }

  return (
    <Section label="Rate Recommendations">
      <p className="text-small text-primary-dark/70">Fixed-threshold, rule-based suggestions off the demand forecast above — not AI. Approving one creates a real seasonal rate plan for that date.</p>
      <div className="max-w-xs">
        <Select id="rate-recommendations-room-type" label="Room Type" options={roomTypeOptions} value={roomTypeId} onChange={setRoomTypeId} placeholder="Choose a room type" />
      </div>
      {error ? <p className="text-small text-red-600">{error}</p> : null}

      {!roomTypeId ? (
        <p className="text-body text-primary-dark/70">Choose a room type to see rate recommendations.</p>
      ) : recommendationsQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading…</p>
      ) : (
        <Card tone="secondary" className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-small font-bold text-secondary text-left">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Day</th>
                <th className="py-2 pr-4">Current Rate</th>
                <th className="py-2 pr-4">Suggested Rate</th>
                <th className="py-2 pr-4">Rationale</th>
                <th className="py-2 pr-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {(recommendationsQuery.data ?? []).map((rec) => (
                <tr key={rec.date} className="border-t border-secondary/10 text-small text-secondary align-top">
                  <td className="py-2 pr-4">{new Date(`${rec.date}T00:00:00.000Z`).toLocaleDateString()}</td>
                  <td className="py-2 pr-4">{rec.dayOfWeek}</td>
                  <td className="py-2 pr-4">{rec.currentBaseRate}</td>
                  <td className="py-2 pr-4">
                    {rec.suggestedRate}
                    {rec.suggestedAdjustmentPct !== 0 ? (
                      <span className={rec.suggestedAdjustmentPct > 0 ? 'text-green-700' : 'text-red-600'}> ({rec.suggestedAdjustmentPct > 0 ? '+' : ''}{rec.suggestedAdjustmentPct}%)</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-4 max-w-xs">{rec.rationale}</td>
                  <td className="py-2 pr-4">
                    {rec.suggestedAdjustmentPct !== 0 ? (
                      <Button size="sm" variant="outline" loading={approvingDate === rec.date && approveMutation.isPending} onClick={() => approve(rec.date, rec.suggestedAdjustmentPct)}>
                        Approve
                      </Button>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </Section>
  );
}
