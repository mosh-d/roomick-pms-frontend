'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { FinancialReportsIcon, DownloadIcon } from '@/components/ui/Icons';
import { useFinancialReportQuery, type FinancialReport, type ReportGroupBy } from '@/lib/reports';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { useAuthStore } from '@/lib/store/authStore';
import { csvCell } from '@/lib/csv';
import { addDays, hotelToday } from '@/lib/dates';
import { ArAgeingSection } from './_components/ArAgeingSection';

const GROUP_BY_OPTIONS: SelectOption[] = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

const DEPARTMENT_LABELS: Record<string, string> = {
  room: 'Rooms',
  fnb: 'Food & Drink',
  spa: 'Spa',
  laundry: 'Laundry',
  minibar: 'Minibar',
  transport: 'Transport',
  penalty: 'Penalties',
  misc: 'Other',
  correction: 'Corrections',
};
/** One colour per department, from the palette's own status colours — the bars are graphics, so they needn't follow the text rule. */
const DEPARTMENT_COLOURS: Record<string, string> = {
  room: 'bg-primary',
  fnb: 'bg-status-occupied',
  spa: 'bg-status-cleaning',
  laundry: 'bg-accent-dark',
  minibar: 'bg-status-out-of-order',
  transport: 'bg-status-vacant',
  penalty: 'bg-red-600',
  misc: 'bg-accent',
  correction: 'bg-secondary-light',
};
const METHOD_LABELS: Record<string, string> = { cash: 'Cash', card: 'Card', bank_transfer: 'Bank transfer', voucher: 'Voucher' };
const METHOD_COLOURS: Record<string, string> = { cash: '#3f8f5c', card: '#cca000', bank_transfer: '#2e7d8c', voucher: '#9a5a2e' };

/** This month so far, at the hotel. */
function monthToDate(): { from: string; to: string } {
  const today = hotelToday();
  return { from: `${today.slice(0, 8)}01`, to: addDays(today, 1) };
}

function download(filename: string, type: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** One row per period: each department's revenue, then tax, money in and money back — the shape an accountant's spreadsheet wants. */
function toRows(report: FinancialReport): Array<Record<string, string>> {
  return report.periods.map((p) => ({
    period: p.period,
    ...Object.fromEntries(report.departments.map((d) => [DEPARTMENT_LABELS[d] ?? d, p.departments[d] ?? '0.00'])),
    revenue: p.revenue,
    tax: p.tax,
    money_in: p.moneyIn,
    money_back: p.moneyBack,
  }));
}

function toCsv(report: FinancialReport): string {
  const rows = toRows(report);
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  return [headers.join(','), ...rows.map((row) => headers.map((h) => `"${row[h].replace(/"/g, '""')}"`).join(','))].join('\n');
}

function escapeXml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function toXml(report: FinancialReport): string {
  const periods = report.periods
    .map(
      (p) =>
        `  <period key="${escapeXml(p.period)}">\n` +
        report.departments.map((d) => `    <revenue department="${escapeXml(d)}">${p.departments[d] ?? '0.00'}</revenue>\n`).join('') +
        `    <tax>${p.tax}</tax>\n    <moneyIn>${p.moneyIn}</moneyIn>\n    <moneyBack>${p.moneyBack}</moneyBack>\n  </period>\n`,
    )
    .join('');
  const taxes = report.taxSummary
    .map((t) => `  <taxRule name="${escapeXml(t.ruleName)}" taxableBase="${t.taxableBase}" collected="${t.taxCollected}"/>\n`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<financialReport from="${report.from}" to="${report.to}" currency="${report.currency}" groupBy="${report.groupBy}">\n${periods}${taxes}  <posWalkInTax>${report.posTax}</posWalkInTax>\n</financialReport>\n`;
}

/**
 * Financial Reports (ref: "Daily revenue, tax, cash flow, monthly summary" —
 * revenue by department, tax breakdown, cash flow, payment methods, export
 * to the accountant). Drawn with plain CSS like Operational Reports — no
 * charting library. Revenue is what was earned (tax excluded), by service
 * date; money in and back is what was paid and refunded, by the day it
 * happened. The export is one row per period, in CSV or XML.
 */
export default function FinancialReportsPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [range, setRange] = useState(monthToDate);
  const [groupBy, setGroupBy] = useState<ReportGroupBy>('day');
  const reportQuery = useFinancialReportQuery(activeBranchId, { from: range.from, to: range.to, groupBy }, auth);
  const report = reportQuery.data;
  const symbol = currencySymbolFor(report?.currency);

  const maxPeriodRevenue = useMemo(() => Math.max(1, ...(report?.periods ?? []).map((p) => Number(p.revenue))), [report]);

  if (!activeBranchId) return null;

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader
        icon={<FinancialReportsIcon className="size-8" />}
        title="Financial Reports"
        subtitle="Revenue, tax and cash flow — daily, weekly or monthly."
        roles="Manager · Owner · Accountant"
        actions={
          report ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => download(`financial-${report.from}-${report.to}.csv`, 'text/csv;charset=utf-8;', toCsv(report))}>
                <DownloadIcon className="size-4" /> CSV
              </Button>
              <Button size="sm" variant="outline" onClick={() => download(`financial-${report.from}-${report.to}.xml`, 'application/xml', toXml(report))}>
                <DownloadIcon className="size-4" /> XML
              </Button>
            </div>
          ) : undefined
        }
      />

      <Section label="Period">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2">
          <Input label="From" name="from" type="date" value={range.from} max={range.to} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
          <Input label="To (not included)" name="to" type="date" value={range.to} min={range.from} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
          <Select id="financial-group-by" name="groupBy" label="Group by" options={GROUP_BY_OPTIONS} value={groupBy} onChange={(v) => setGroupBy(v as ReportGroupBy)} />
        </div>
      </Section>

      {reportQuery.isLoading ? (
        <p className="text-body text-surface-muted">Loading…</p>
      ) : reportQuery.isError || !report ? (
        <p className="text-body text-red-600">Could not load the report.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
            <Kpi label="Revenue" value={formatMoney(report.summary.revenue, symbol)} />
            <Kpi label="Tax" value={formatMoney(report.summary.tax, symbol)} />
            <Kpi label="Billed" value={formatMoney(report.summary.billed, symbol)} />
            <Kpi label="Money in" value={formatMoney(report.summary.moneyIn, symbol)} />
            <Kpi label="Money back" value={formatMoney(report.summary.moneyBack, symbol)} />
            <Kpi label="Net money in" value={formatMoney(report.summary.net, symbol)} />
          </div>

          <Section label="Revenue by Department">
            {report.departments.length === 0 ? (
              <p className="text-body text-surface-muted">Nothing was earned in these dates.</p>
            ) : (
              <>
                <div className="flex items-end gap-1 h-48 overflow-x-auto pb-1" role="img" aria-label="Revenue by department, per period">
                  {report.periods.map((p) => (
                    <div key={p.period} className="flex flex-col items-center gap-1 shrink-0 w-10" title={`${p.period}: ${formatMoney(p.revenue, symbol)}`}>
                      <div className="w-6 flex flex-col-reverse rounded-t overflow-hidden" style={{ height: `${Math.max(2, (Number(p.revenue) / maxPeriodRevenue) * 160)}px` }}>
                        {report.departments.map((d) => {
                          const share = Number(p.revenue) > 0 ? Math.max(0, Number(p.departments[d] ?? 0)) / Number(p.revenue) : 0;
                          return share > 0 ? <div key={d} className={DEPARTMENT_COLOURS[d] ?? 'bg-accent'} style={{ height: `${share * 100}%` }} /> : null;
                        })}
                      </div>
                      <span className="text-tiny text-surface-muted whitespace-nowrap">{groupBy === 'month' ? p.period : p.period.slice(5)}</span>
                    </div>
                  ))}
                </div>
                <ul className="flex flex-wrap gap-x-5 gap-y-2">
                  {report.departments.map((d) => {
                    const total = report.periods.reduce((sum, p) => sum + Number(p.departments[d] ?? 0), 0);
                    return (
                      <li key={d} className="flex items-center gap-2 text-small text-surface">
                        <span className={`size-3 rounded-sm ${DEPARTMENT_COLOURS[d] ?? 'bg-accent'}`} aria-hidden />
                        {DEPARTMENT_LABELS[d] ?? d} <span className="text-surface-muted">{formatMoney(total, symbol)}</span>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            <Section label="Cash Flow">
              <CashFlow report={report} symbol={symbol} />
            </Section>
            <Section label="Payment Methods">
              <PaymentMethods report={report} symbol={symbol} />
            </Section>
          </div>

          <Section label="Tax Summary">
            {report.taxSummary.length === 0 && Number(report.posTax) === 0 ? (
              <p className="text-body text-surface-muted">No tax was charged in these dates.</p>
            ) : (
              <Card tone="secondary" className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-secondary/20">
                      <th className="text-small font-bold text-surface pb-2 pr-4">Tax</th>
                      <th className="text-small font-bold text-surface pb-2 pr-4">Rate</th>
                      <th className="text-small font-bold text-surface pb-2 pr-4 text-right">Taxable base</th>
                      <th className="text-small font-bold text-surface pb-2 text-right">Collected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.taxSummary.map((t) => (
                      <tr key={t.ruleId} className="border-b border-secondary/10">
                        <td className="text-small text-surface py-2 pr-4">{t.ruleName}</td>
                        <td className="text-small text-surface py-2 pr-4">
                          {t.type === 'fixed' ? `${formatMoney(t.fixedAmount ?? '0', symbol)} a charge` : `${Number((Number(t.rate) * 100).toFixed(2))}%`}
                          {t.inclusive ? ', included in prices' : ''}
                        </td>
                        <td className="text-small text-surface py-2 pr-4 text-right">{formatMoney(t.taxableBase, symbol)}</td>
                        <td className="text-small text-surface py-2 text-right">{formatMoney(t.taxCollected, symbol)}</td>
                      </tr>
                    ))}
                    {Number(report.posTax) !== 0 ? (
                      <tr className="border-b border-secondary/10">
                        <td className="text-small text-surface py-2 pr-4">Point of Sale walk-in sales</td>
                        <td className="text-small text-surface-muted py-2 pr-4">Every rule, together</td>
                        <td className="text-small text-surface-muted py-2 pr-4 text-right">—</td>
                        <td className="text-small text-surface py-2 text-right">{formatMoney(report.posTax, symbol)}</td>
                      </tr>
                    ) : null}
                    <tr>
                      <td className="text-small font-bold text-surface pt-2" colSpan={3}>
                        Total tax
                      </td>
                      <td className="text-small font-bold text-surface pt-2 text-right">{formatMoney(report.summary.tax, symbol)}</td>
                    </tr>
                  </tbody>
                </table>
              </Card>
            )}
          </Section>
        </>
      )}

      <ArAgeingSection branchId={activeBranchId} auth={auth} />
    </Container>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <Card tone="accent" className="flex flex-col gap-1">
      <p className="text-tiny text-surface-muted">{label}</p>
      <p className="text-body font-bold text-surface break-words">{value}</p>
    </Card>
  );
}

/**
 * Waterfall: money in by method stacks up from zero, money back comes off,
 * and the last bar is what's left. Each step is a bar floated at the running
 * total it starts from.
 */
function CashFlow({ report, symbol }: { report: FinancialReport; symbol: string }) {
  const steps: Array<{ label: string; amount: number; kind: 'in' | 'back' | 'net' }> = [
    ...report.paymentMethods.filter((m) => Number(m.moneyIn) > 0).map((m) => ({ label: METHOD_LABELS[m.method] ?? m.method, amount: Number(m.moneyIn), kind: 'in' as const })),
    ...(Number(report.summary.moneyBack) > 0 ? [{ label: 'Money back', amount: Number(report.summary.moneyBack), kind: 'back' as const }] : []),
    { label: 'Net', amount: Number(report.summary.net), kind: 'net' as const },
  ];
  const top = Math.max(1, Number(report.summary.moneyIn));
  // Where each bar starts: money in stacks up from zero, money back comes off the top, the net stands on zero.
  const bars = steps.reduce<Array<(typeof steps)[number] & { bottom: number; height: number }>>((acc, step) => {
    const before = acc.length ? acc[acc.length - 1] : null;
    const runningTotal = before ? (before.kind === 'in' ? before.bottom + before.height : before.bottom) : 0;
    if (step.kind === 'in') acc.push({ ...step, bottom: runningTotal, height: step.amount });
    else if (step.kind === 'back') acc.push({ ...step, bottom: runningTotal - step.amount, height: step.amount });
    else acc.push({ ...step, bottom: 0, height: Math.max(0, step.amount) });
    return acc;
  }, []);
  if (steps.length === 1 && steps[0].amount === 0) return <p className="text-body text-surface-muted">No money came in or went back in these dates.</p>;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-3 h-48 overflow-x-auto" role="img" aria-label="Cash flow waterfall">
        {bars.map((bar) => (
          <div key={bar.label} className="relative h-full w-16 shrink-0" title={`${bar.label}: ${formatMoney(bar.amount, symbol)}`}>
            <div
              className={`absolute left-1 right-1 rounded-sm ${bar.kind === 'in' ? 'bg-status-vacant' : bar.kind === 'back' ? 'bg-red-600' : 'bg-primary'}`}
              style={{ bottom: `${(bar.bottom / top) * 100}%`, height: `${Math.max(1, (bar.height / top) * 100)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3 overflow-x-auto">
        {steps.map((step) => (
          <div key={step.label} className="w-16 shrink-0 text-center">
            <p className="text-tiny text-surface-muted truncate" title={step.label}>
              {step.label}
            </p>
          </div>
        ))}
      </div>
      <ul className="flex flex-col gap-1">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center justify-between gap-4 text-small text-surface">
            <span>{step.label}</span>
            <span className={step.kind === 'back' ? 'text-red-700' : 'font-semibold'}>
              {step.kind === 'back' ? '−' : ''}
              {formatMoney(step.amount, symbol)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** A donut drawn with one CSS conic-gradient — each method's share of the money that came in. */
function PaymentMethods({ report, symbol }: { report: FinancialReport; symbol: string }) {
  const incoming = report.paymentMethods.filter((m) => Number(m.moneyIn) > 0);
  const total = incoming.reduce((sum, m) => sum + Number(m.moneyIn), 0);
  if (total === 0) return <p className="text-body text-surface-muted">No money came in in these dates.</p>;
  const stops = incoming
    .map((m, index) => {
      const start = incoming.slice(0, index).reduce((sum, earlier) => sum + (Number(earlier.moneyIn) / total) * 100, 0);
      const share = (Number(m.moneyIn) / total) * 100;
      return `${METHOD_COLOURS[m.method] ?? '#a1abb2'} ${start}% ${start + share}%`;
    })
    .join(', ');
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative size-36 shrink-0 rounded-full" style={{ background: `conic-gradient(${stops})` }} role="img" aria-label="Money in by payment method">
        <div className="absolute inset-6 rounded-full bg-white" />
      </div>
      <ul className="flex flex-col gap-2 min-w-0">
        {incoming.map((m) => (
          <li key={m.method} className="flex items-center gap-2 text-small text-surface">
            <span className="size-3 rounded-sm shrink-0" style={{ background: METHOD_COLOURS[m.method] ?? '#a1abb2' }} aria-hidden />
            {METHOD_LABELS[m.method] ?? m.method}
            <span className="text-surface-muted">
              {formatMoney(m.moneyIn, symbol)} · {Math.round((Number(m.moneyIn) / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
