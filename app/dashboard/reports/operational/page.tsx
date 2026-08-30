'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReportsIcon, DownloadIcon } from '@/components/ui/Icons';
import { useOccupancyReportQuery, useAdrReportQuery, useRevparReportQuery, useRevenueReportQuery, reportPdfPath, type ReportGroupBy } from '@/lib/reports';
import { useRoomTypesQuery } from '@/lib/rooms';
import { currencySymbolFor } from '@/lib/currencies';
import { downloadFile, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

type ReportType = 'occupancy' | 'adr' | 'revpar' | 'revenue';

const REPORT_TABS: Array<{ value: ReportType; label: string }> = [
  { value: 'occupancy', label: 'Occupancy' },
  { value: 'adr', label: 'ADR' },
  { value: 'revpar', label: 'RevPAR' },
  { value: 'revenue', label: 'Revenue' },
];

const GROUP_BY_OPTIONS: SelectOption[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 86400000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function downloadCsv(filename: string, rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(','), ...rows.map((row) => headers.map((h) => `"${String(row[h]).replace(/"/g, '""')}"`).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Trend line, drawn as CSS bars rather than pulling in a charting library —
 * no page anywhere in this app uses one yet (Overbooking's own exposure
 * heatmap is a plain coloured-cell table, same restraint), and a scaled bar
 * row conveys a trend just as well for MVP without a new dependency.
 */
function TrendBars({ data, formatValue }: { data: Array<{ label: string; value: number }>; formatValue: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="flex items-end gap-1 h-32 overflow-x-auto">
      {data.map((d) => (
        <div key={d.label} className="flex flex-col items-center gap-1 shrink-0 w-8" title={`${d.label}: ${formatValue(d.value)}`}>
          <div className="w-5 bg-primary/70 rounded-t" style={{ height: `${Math.max(2, (d.value / max) * 100)}px` }} />
          <span className="text-tiny text-primary-dark/60 rotate-0 whitespace-nowrap">{d.label.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card tone="accent" className="flex-1 min-w-40">
      <p className="text-tiny text-primary-dark/70">{label}</p>
      <p className="text-header font-bold text-primary-dark">{value}</p>
    </Card>
  );
}

/**
 * Operational Reports (ref: MVP timeline Month 5) — Occupancy, ADR, RevPAR,
 * Revenue. Materialized views (the reference's own suggestion) were
 * deliberately skipped: live aggregate queries over Reservation/LineItem/
 * Payment are simpler, always correct with no refresh-lag, and this
 * project's data volumes don't need the optimisation yet — the same
 * "duplication/simplicity over premature infra" call made for the Folios
 * accrual model. Arrivals/Departures and Outstanding Balances are NOT
 * rebuilt here — they already have their own dashboards (Arrivals/
 * Departures Dashboard, Billing's Outstanding tab); this page doesn't
 * duplicate them.
 *
 * Moved from `/dashboard/reports` to `/dashboard/reports/operational` so
 * that route could become the Reports & Analytics hub (ref p20): this is
 * one of its three cards, the only one that's real.
 */
export default function OperationalReportsPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [reportType, setReportType] = useState<ReportType>('occupancy');
  const [{ from, to }, setRange] = useState(defaultRange);
  const [groupBy, setGroupBy] = useState<string | null>('day');
  const [roomTypeId, setRoomTypeId] = useState<string | null>(null);
  const [pdfPending, setPdfPending] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const roomTypesQuery = useRoomTypesQuery(activeBranchId, auth);
  const roomTypeOptions: SelectOption[] = useMemo(
    () => [{ value: '', label: 'All Room Types' }, ...(roomTypesQuery.data ?? []).map((rt) => ({ value: rt.id, label: rt.name }))],
    [roomTypesQuery.data],
  );

  const params = { from, to, groupBy: (groupBy as ReportGroupBy) ?? undefined, roomTypeId: roomTypeId ?? undefined };
  const occupancyQuery = useOccupancyReportQuery(activeBranchId, params, auth);
  const adrQuery = useAdrReportQuery(activeBranchId, params, auth);
  const revparQuery = useRevparReportQuery(activeBranchId, params, auth);
  const revenueQuery = useRevenueReportQuery(activeBranchId, params, auth);

  async function handleExportPdf() {
    if (!activeBranchId) return;
    setPdfError(null);
    setPdfPending(true);
    try {
      await downloadFile(reportPdfPath(activeBranchId, reportType, params), `${reportType}-report-${from}-to-${to}.pdf`, auth);
    } catch (error) {
      setPdfError(error instanceof ApiError ? error.message : 'Could not export the PDF. Please try again.');
    } finally {
      setPdfPending(false);
    }
  }

  if (!activeBranchId) return null;

  const symbol =
    reportType === 'adr' ? currencySymbolFor(adrQuery.data?.currency) : reportType === 'revpar' ? currencySymbolFor(revparQuery.data?.currency) : currencySymbolFor(revenueQuery.data?.currency);

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-6">
      <PageHeader icon={<ReportsIcon className="size-8" />} title="Operational Reports" subtitle="Occupancy, ADR, RevPAR, no-shows, cancellations" roles="Manager · Owner · Accountant" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex rounded-control border border-accent/30 p-1 gap-1">
          {REPORT_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setReportType(tab.value)}
              className={`rounded-control px-3 py-1.5 text-small font-semibold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                reportType === tab.value ? 'bg-primary text-white' : 'text-primary-dark hover:bg-accent/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col items-end gap-1">
          <Button type="button" variant="outline" loading={pdfPending} onClick={handleExportPdf}>
            <DownloadIcon className="size-4" /> Export PDF
          </Button>
          {pdfError ? <p className="text-tiny text-red-600">{pdfError}</p> : null}
        </div>
      </div>

      <Section label="Date Range & Filters">
        <div className="flex flex-wrap gap-4">
          <div className="w-40">
            <Input name="from" label="From" type="date" value={from} onChange={(e) => setRange({ from: e.target.value, to })} />
          </div>
          <div className="w-40">
            <Input name="to" label="To" type="date" min={from} value={to} onChange={(e) => setRange({ from, to: e.target.value })} />
          </div>
          {reportType === 'occupancy' ? (
            <div className="w-32">
              <Select id="groupBy" name="groupBy" label="Group By" options={GROUP_BY_OPTIONS} value={groupBy} onChange={setGroupBy} />
            </div>
          ) : null}
          <div className="w-48">
            <Select name="roomTypeId" label="Room Type" options={roomTypeOptions} value={roomTypeId} onChange={setRoomTypeId} />
          </div>
        </div>
      </Section>

      {reportType === 'occupancy' ? (
        occupancyQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading…</p>
        ) : occupancyQuery.data ? (
          <>
            <div className="flex flex-wrap gap-4">
              <KpiCard label="Occupancy %" value={`${occupancyQuery.data.summary.occupancyPct}%`} />
              <KpiCard label="Room-Nights Sold" value={String(occupancyQuery.data.summary.roomNightsSold)} />
              <KpiCard label="Room-Nights Available" value={String(occupancyQuery.data.summary.roomNightsAvailable)} />
            </div>
            <Section label="Trend">
              <TrendBars data={occupancyQuery.data.trend.map((t) => ({ label: t.period, value: t.occupancyPct }))} formatValue={(v) => `${v}%`} />
            </Section>
            <BreakdownSection
              title="Room Type Breakdown"
              onExport={() => downloadCsv('occupancy-by-room-type.csv', occupancyQuery.data!.byRoomType.map((r) => ({ 'Room Type': r.roomTypeName, 'Room-Nights Available': r.roomNightsAvailable, 'Room-Nights Sold': r.roomNightsSold, 'Occupancy %': r.occupancyPct })))}
            >
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-small font-bold text-secondary text-left">
                    <th className="py-2 pr-4">Room Type</th>
                    <th className="py-2 pr-4">Available</th>
                    <th className="py-2 pr-4">Sold</th>
                    <th className="py-2 pr-4">Occupancy %</th>
                  </tr>
                </thead>
                <tbody>
                  {occupancyQuery.data.byRoomType.map((r) => (
                    <tr key={r.roomTypeId} className="border-t border-secondary/10 text-small text-secondary">
                      <td className="py-2 pr-4">{r.roomTypeName}</td>
                      <td className="py-2 pr-4">{r.roomNightsAvailable}</td>
                      <td className="py-2 pr-4">{r.roomNightsSold}</td>
                      <td className="py-2 pr-4">{r.occupancyPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </BreakdownSection>
          </>
        ) : null
      ) : null}

      {reportType === 'adr' ? (
        adrQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading…</p>
        ) : adrQuery.data ? (
          <>
            <div className="flex flex-wrap gap-4">
              <KpiCard label="ADR" value={`${symbol}${adrQuery.data.summary.adr}`} />
              <KpiCard label="Room Revenue" value={`${symbol}${adrQuery.data.summary.roomRevenue}`} />
              <KpiCard label="Room-Nights Sold" value={String(adrQuery.data.summary.roomNightsSold)} />
            </div>
            <Section label="Trend">
              <TrendBars data={adrQuery.data.trend.map((t) => ({ label: t.period, value: Number(t.adr) }))} formatValue={(v) => `${symbol}${v.toFixed(2)}`} />
            </Section>
            <BreakdownSection
              title="Room Type Breakdown"
              onExport={() => downloadCsv('adr-by-room-type.csv', adrQuery.data!.byRoomType.map((r) => ({ 'Room Type': r.roomTypeName, 'Room-Nights Sold': r.roomNightsSold, 'Room Revenue': r.roomRevenue, ADR: r.adr })))}
            >
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-small font-bold text-secondary text-left">
                    <th className="py-2 pr-4">Room Type</th>
                    <th className="py-2 pr-4">Sold</th>
                    <th className="py-2 pr-4">Revenue</th>
                    <th className="py-2 pr-4">ADR</th>
                  </tr>
                </thead>
                <tbody>
                  {adrQuery.data.byRoomType.map((r) => (
                    <tr key={r.roomTypeId} className="border-t border-secondary/10 text-small text-secondary">
                      <td className="py-2 pr-4">{r.roomTypeName}</td>
                      <td className="py-2 pr-4">{r.roomNightsSold}</td>
                      <td className="py-2 pr-4">{symbol}{r.roomRevenue}</td>
                      <td className="py-2 pr-4">{symbol}{r.adr}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </BreakdownSection>
          </>
        ) : null
      ) : null}

      {reportType === 'revpar' ? (
        revparQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading…</p>
        ) : revparQuery.data ? (
          <>
            <div className="flex flex-wrap gap-4">
              <KpiCard label="RevPAR" value={`${symbol}${revparQuery.data.summary.revpar}`} />
              <KpiCard label="Room Revenue" value={`${symbol}${revparQuery.data.summary.roomRevenue}`} />
              <KpiCard label="Room-Nights Available" value={String(revparQuery.data.summary.roomNightsAvailable)} />
            </div>
            <Section label="Trend">
              <TrendBars data={revparQuery.data.trend.map((t) => ({ label: t.period, value: Number(t.revpar) }))} formatValue={(v) => `${symbol}${v.toFixed(2)}`} />
            </Section>
            <BreakdownSection
              title="Room Type Breakdown"
              onExport={() => downloadCsv('revpar-by-room-type.csv', revparQuery.data!.byRoomType.map((r) => ({ 'Room Type': r.roomTypeName, 'Room-Nights Available': r.roomNightsAvailable, 'Room Revenue': r.roomRevenue, RevPAR: r.revpar })))}
            >
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-small font-bold text-secondary text-left">
                    <th className="py-2 pr-4">Room Type</th>
                    <th className="py-2 pr-4">Available</th>
                    <th className="py-2 pr-4">Revenue</th>
                    <th className="py-2 pr-4">RevPAR</th>
                  </tr>
                </thead>
                <tbody>
                  {revparQuery.data.byRoomType.map((r) => (
                    <tr key={r.roomTypeId} className="border-t border-secondary/10 text-small text-secondary">
                      <td className="py-2 pr-4">{r.roomTypeName}</td>
                      <td className="py-2 pr-4">{r.roomNightsAvailable}</td>
                      <td className="py-2 pr-4">{symbol}{r.roomRevenue}</td>
                      <td className="py-2 pr-4">{symbol}{r.revpar}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </BreakdownSection>
          </>
        ) : null
      ) : null}

      {reportType === 'revenue' ? (
        revenueQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading…</p>
        ) : revenueQuery.data ? (
          <>
            <div className="flex flex-wrap gap-4">
              <KpiCard label="Total Revenue" value={`${symbol}${revenueQuery.data.summary.totalRevenue}`} />
            </div>
            <Section label="Trend">
              <TrendBars data={revenueQuery.data.trend.map((t) => ({ label: t.period, value: Number(t.amount) }))} formatValue={(v) => `${symbol}${v.toFixed(2)}`} />
            </Section>
            <BreakdownSection
              title="Revenue by Department"
              onExport={() => downloadCsv('revenue-by-department.csv', revenueQuery.data!.byDepartment.map((d) => ({ Department: d.chargeType, Amount: d.amount })))}
            >
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-small font-bold text-secondary text-left">
                    <th className="py-2 pr-4">Department</th>
                    <th className="py-2 pr-4">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueQuery.data.byDepartment.map((d) => (
                    <tr key={d.chargeType} className="border-t border-secondary/10 text-small text-secondary capitalize">
                      <td className="py-2 pr-4">{d.chargeType}</td>
                      <td className="py-2 pr-4">{symbol}{d.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </BreakdownSection>
            <BreakdownSection
              title="Revenue by Payment Method"
              onExport={() => downloadCsv('revenue-by-payment-method.csv', revenueQuery.data!.byPaymentMethod.map((p) => ({ Method: p.method, Amount: p.amount })))}
            >
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-small font-bold text-secondary text-left">
                    <th className="py-2 pr-4">Method</th>
                    <th className="py-2 pr-4">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {revenueQuery.data.byPaymentMethod.map((p) => (
                    <tr key={p.method} className="border-t border-secondary/10 text-small text-secondary capitalize">
                      <td className="py-2 pr-4">{p.method.replace('_', ' ')}</td>
                      <td className="py-2 pr-4">{symbol}{p.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </BreakdownSection>
          </>
        ) : null
      ) : null}
    </Container>
  );
}

function BreakdownSection({ title, onExport, children }: { title: string; onExport: () => void; children: React.ReactNode }) {
  return (
    <Section label={title}>
      <Card tone="secondary" className="overflow-x-auto">
        {children}
      </Card>
      <Button type="button" variant="outline" onClick={onExport} className="self-start">
        <DownloadIcon className="size-4" /> Export CSV
      </Button>
    </Section>
  );
}
