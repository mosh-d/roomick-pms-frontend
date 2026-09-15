'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  useAvailabilityRestrictionsQuery,
  useCreateAvailabilityRestrictionMutation,
  useDeleteAvailabilityRestrictionMutation,
  useDemandForecastQuery,
  useRateRecommendationsQuery,
  useApproveRateRecommendationMutation,
  useCompetitorsQuery,
  useCreateCompetitorMutation,
  useUpdateCompetitorMutation,
  useSetCompetitorRatesMutation,
  useCompSetQuery,
  type CompSetDay,
  type MarketPosition,
} from '@/lib/revenueManagement';
import { useRoomTypesQuery } from '@/lib/rooms';
import { ApiError } from '@/lib/api';
import { currencySymbolFor } from '@/lib/currencies';
import { formatMoney } from '@/lib/numberFormat';
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
 * other rate plan on this app already goes through. Comp Set Analysis takes
 * competitor rates entered by hand (no rate-shopping feed is connected) and
 * compares them with the Rate Resolver's own one-night rate.
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

      <CompSetSection branchId={activeBranchId} auth={auth} />
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

const COMP_SET_DAYS = 14;

const POSITION_BADGES: Record<MarketPosition, { label: string; className: string }> = {
  above_market: { label: 'Above market', className: 'bg-orange-100 text-orange-800' },
  in_line: { label: 'In line', className: 'bg-green-100 text-green-800' },
  below_market: { label: 'Below market', className: 'bg-sky-100 text-sky-800' },
  no_data: { label: 'No comp data', className: 'bg-secondary/10 text-secondary-light' },
};

function formatNight(date: string): string {
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString(undefined, { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });
}

function PositionBadge({ day }: { day: CompSetDay }) {
  const badge = POSITION_BADGES[day.position];
  const diff = day.position !== 'no_data' && day.diffPct !== null ? ` ${day.diffPct > 0 ? '+' : ''}${day.diffPct}%` : '';
  return (
    <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-tiny font-semibold whitespace-nowrap ${badge.className}`}>
      {badge.label}
      {diff}
    </span>
  );
}

function CompSetSection({ branchId, auth }: { branchId: string; auth: AuthOpts }) {
  const roomTypesQuery = useRoomTypesQuery(branchId, auth);
  const competitorsQuery = useCompetitorsQuery(branchId, auth);
  const createCompetitor = useCreateCompetitorMutation(branchId, auth);
  const updateCompetitor = useUpdateCompetitorMutation(branchId, auth);
  const setRates = useSetCompetitorRatesMutation(branchId, auth);

  const [chosenRoomTypeId, setChosenRoomTypeId] = useState<string | null>(null);
  const roomTypeId = chosenRoomTypeId ?? roomTypesQuery.data?.[0]?.id ?? null;
  const compSetQuery = useCompSetQuery(branchId, roomTypeId, COMP_SET_DAYS, auth);

  const [newCompetitor, setNewCompetitor] = useState('');
  const [competitorError, setCompetitorError] = useState<string | null>(null);
  const [rateCompetitorId, setRateCompetitorId] = useState<string | null>(null);
  const [rateFrom, setRateFrom] = useState('');
  const [rateThrough, setRateThrough] = useState('');
  const [rateAmount, setRateAmount] = useState('');
  const [rateMessage, setRateMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null);

  const roomTypeOptions = useMemo(() => (roomTypesQuery.data ?? []).map((rt) => ({ value: rt.id, label: rt.name })), [roomTypesQuery.data]);
  const competitors = competitorsQuery.data ?? [];
  const activeCompetitors = competitors.filter((c) => c.isActive);
  const analysis = compSetQuery.data;
  const symbol = currencySymbolFor(analysis?.currency);

  async function addCompetitor() {
    if (!newCompetitor.trim()) return;
    setCompetitorError(null);
    try {
      await createCompetitor.mutateAsync({ name: newCompetitor.trim() });
      setNewCompetitor('');
    } catch (err) {
      setCompetitorError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  function toggleCompetitor(competitorId: string, isActive: boolean) {
    setCompetitorError(null);
    updateCompetitor.mutate(
      { competitorId, isActive },
      { onError: (err) => setCompetitorError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.') },
    );
  }

  async function saveRates(clear: boolean) {
    if (!rateCompetitorId || !roomTypeId || !rateFrom) return;
    setRateMessage(null);
    try {
      const result = await setRates.mutateAsync({
        competitorId: rateCompetitorId,
        roomTypeId,
        fromDate: rateFrom,
        throughDate: rateThrough || rateFrom,
        ...(clear ? { clear: true } : { rate: Number(rateAmount) }),
      });
      const nights = `${result.nights} night${result.nights === 1 ? '' : 's'}`;
      setRateMessage({ kind: 'ok', text: clear ? `Cleared ${nights}.` : `Saved for ${nights}.` });
      if (!clear) setRateAmount('');
    } catch (err) {
      setRateMessage({ kind: 'error', text: err instanceof ApiError ? err.message : 'Something went wrong. Please try again.' });
    }
  }

  return (
    <Section label="Comp Set Analysis">
      <p className="text-small text-primary-dark/70">
        Competitor rates are entered by hand — no rate-shopping feed is connected. Our rate is what the booking engine quotes for a one-night stay; a night is
        flagged when it&rsquo;s more than {analysis?.thresholdPct ?? 10}% from the comp set&rsquo;s median.
      </p>

      <Card tone="accent" className="flex flex-col gap-3">
        <p className="text-small font-semibold text-primary-dark">Competitors</p>
        {competitorsQuery.isSuccess && competitors.length === 0 ? (
          <p className="text-small text-primary-dark/70">None yet — add the hotels you price yourself against.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {competitors.map((c) => (
              <li
                key={c.id}
                className={`flex items-center gap-2 rounded-pill border border-secondary/20 px-3 py-1 text-small ${c.isActive ? 'text-secondary' : 'text-secondary-light line-through'}`}
              >
                {c.name}
                <button
                  type="button"
                  onClick={() => toggleCompetitor(c.id, !c.isActive)}
                  className="text-tiny font-semibold underline cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                  aria-label={c.isActive ? `Take ${c.name} out of the comp set` : `Put ${c.name} back in the comp set`}
                >
                  {c.isActive ? 'Remove' : 'Add back'}
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-end gap-3 max-w-xl">
          <div className="flex-1 min-w-48">
            <Input
              id="comp-set-new-competitor"
              label="Add a Competitor"
              value={newCompetitor}
              onChange={(e) => setNewCompetitor(e.target.value)}
              placeholder="Eko Signature Hotel"
              maxLength={150}
            />
          </div>
          <Button type="button" variant="outline" onClick={addCompetitor} loading={createCompetitor.isPending} disabled={!newCompetitor.trim()}>
            Add
          </Button>
        </div>
        {competitorError ? <p className="text-small text-red-600">{competitorError}</p> : null}
      </Card>

      <div className="max-w-xs">
        <Select id="comp-set-room-type" label="Our Room Type" options={roomTypeOptions} value={roomTypeId} onChange={setChosenRoomTypeId} placeholder="Choose a room type" />
      </div>

      {activeCompetitors.length > 0 && roomTypeId ? (
        <Card tone="accent" className="flex flex-col gap-3">
          <p className="text-small font-semibold text-primary-dark">
            Enter a competitor&rsquo;s nightly rate for their room closest to our {analysis?.roomTypeName ?? 'room type'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2">
            <Select
              id="comp-set-rate-competitor"
              label="Competitor"
              options={activeCompetitors.map((c) => ({ value: c.id, label: c.name }))}
              value={rateCompetitorId}
              onChange={setRateCompetitorId}
              placeholder="Choose"
            />
            <Input id="comp-set-rate-from" label="From" type="date" value={rateFrom} onChange={(e) => setRateFrom(e.target.value)} />
            <Input
              id="comp-set-rate-through"
              label="Through (optional)"
              type="date"
              min={rateFrom || undefined}
              value={rateThrough}
              onChange={(e) => setRateThrough(e.target.value)}
            />
            <Input id="comp-set-rate-amount" label="Their Nightly Rate" type="number" min={0} step="0.01" value={rateAmount} onChange={(e) => setRateAmount(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => saveRates(false)} loading={setRates.isPending} disabled={!rateCompetitorId || !rateFrom || rateAmount === ''}>
              Save Rate
            </Button>
            <Button type="button" variant="outline" onClick={() => saveRates(true)} disabled={!rateCompetitorId || !rateFrom || setRates.isPending}>
              Clear These Nights
            </Button>
          </div>
          {rateMessage ? <p className={`text-small ${rateMessage.kind === 'error' ? 'text-red-600' : 'text-green-700'}`}>{rateMessage.text}</p> : null}
        </Card>
      ) : null}

      {!roomTypeId ? (
        <p className="text-body text-primary-dark/70">Add a room type to compare rates.</p>
      ) : compSetQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading…</p>
      ) : compSetQuery.isError ? (
        <p className="text-small text-red-600">{compSetQuery.error instanceof ApiError ? compSetQuery.error.message : 'Couldn’t load the comp set.'}</p>
      ) : analysis ? (
        <Card tone="secondary" className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-small font-bold text-secondary text-left">
                <th className="py-2 pr-4">Night</th>
                <th className="py-2 pr-4">Our Rate</th>
                {analysis.competitors.map((c) => (
                  <th key={c.id} className="py-2 pr-4">
                    {c.name}
                  </th>
                ))}
                <th className="py-2 pr-4">Market Median</th>
                <th className="py-2 pr-4">Position</th>
              </tr>
            </thead>
            <tbody>
              {analysis.days.map((d) => (
                <tr key={d.date} className="border-t border-secondary/10 text-small text-secondary">
                  <td className="py-2 pr-4 whitespace-nowrap">{formatNight(d.date)}</td>
                  <td className="py-2 pr-4 whitespace-nowrap font-semibold">{formatMoney(d.ourRate, symbol)}</td>
                  {d.competitorRates.map((r) => (
                    <td key={r.competitorId} className="py-2 pr-4 whitespace-nowrap">
                      {r.rate ? formatMoney(r.rate, symbol) : '—'}
                    </td>
                  ))}
                  <td className="py-2 pr-4 whitespace-nowrap">{d.marketMedian ? formatMoney(d.marketMedian, symbol) : '—'}</td>
                  <td className="py-2 pr-4">
                    <PositionBadge day={d} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}
    </Section>
  );
}
