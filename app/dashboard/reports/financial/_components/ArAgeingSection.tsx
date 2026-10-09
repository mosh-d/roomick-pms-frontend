'use client';

import Link from 'next/link';
import { Fragment, useState } from 'react';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { DownloadIcon } from '@/components/ui/Icons';
import { csvCell } from '@/lib/csv';
import { currencySymbolFor } from '@/lib/currencies';
import { formatDateOnly, hotelToday } from '@/lib/dates';
import { formatMoney } from '@/lib/numberFormat';
import { useArAgeingQuery, type AgeingBucket, type ArAgeingReport } from '@/lib/reports';

const BUCKET_LABELS: Record<AgeingBucket, string> = { '0-30': '0–30 days', '31-60': '31–60 days', '61-90': '61–90 days', '90+': 'Over 90 days' };

function toCsv(report: ArAgeingReport): string {
  const header = ['Debtor', 'Type', 'Guest', 'Booking', 'Invoice', 'Due', 'Since', 'Days', 'Bucket', 'Balance'];
  const lines = report.debtors.flatMap((d) =>
    d.bills.map((b) => [d.name, d.type, b.guestName, b.confirmationNumber ?? '', b.invoice?.number ?? '', b.invoice?.dueDate ?? '', b.since, String(b.ageDays), b.bucket, b.balance]),
  );
  return [header, ...lines].map((row) => row.map(csvCell).join(',')).join('\n');
}

/**
 * Accounts receivable ageing: what guests who have left — and companies —
 * still owe, by who owes it and for how long. A bill's age counts from its
 * latest invoice, else the day the stay ended.
 */
export function ArAgeingSection({ branchId, auth }: { branchId: string; auth: { accessToken: string | undefined; tenantId: string | undefined } }) {
  const [asOf, setAsOf] = useState<string>(hotelToday);
  const [open, setOpen] = useState<string | null>(null);
  const query = useArAgeingQuery(branchId, asOf || null, auth);
  const report = query.data;
  const symbol = currencySymbolFor(report?.currency);

  function downloadCsv() {
    if (!report) return;
    const blob = new Blob([toCsv(report)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ar-ageing-${report.asOf}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Section label="Accounts Receivable Ageing">
      <div className="flex flex-wrap items-end gap-4">
        <div className="w-48">
          <Input label="As of" name="ar-as-of" type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
        </div>
        {report && report.debtors.length > 0 ? (
          <Button size="sm" variant="outline" onClick={downloadCsv}>
            <DownloadIcon className="size-4" /> CSV
          </Button>
        ) : null}
      </div>
      {query.isLoading ? (
        <p className="text-body text-surface-muted">Loading…</p>
      ) : query.isError || !report ? (
        <p className="text-body text-red-600">Could not load the ageing.</p>
      ) : report.debtors.length === 0 ? (
        <p className="text-body text-surface-muted">Nobody who has left owes anything.</p>
      ) : (
        <Card tone="secondary" className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-secondary/20">
                <th className="text-small font-bold text-surface pb-2 pr-4">Owed by</th>
                {report.buckets.map((b) => (
                  <th key={b} className="text-small font-bold text-surface pb-2 pr-4 text-right whitespace-nowrap">
                    {BUCKET_LABELS[b]}
                  </th>
                ))}
                <th className="text-small font-bold text-surface pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {report.debtors.map((d) => (
                <Fragment key={d.key}>
                  <tr className="border-b border-secondary/10 cursor-pointer" onClick={() => setOpen(open === d.key ? null : d.key)}>
                    <td className="text-small text-surface py-2 pr-4">
                      <span className="font-semibold">{d.name}</span>
                      <span className="text-tiny text-surface-muted"> · {d.type === 'company' ? 'company' : 'guest'} · {d.bills.length} bill{d.bills.length === 1 ? '' : 's'}</span>
                    </td>
                    {report.buckets.map((b) => (
                      <td key={b} className={`text-small py-2 pr-4 text-right ${Number(d.buckets[b]) > 0 ? (b === '0-30' ? 'text-surface' : 'text-red-600 font-semibold') : 'text-surface-muted'}`}>
                        {Number(d.buckets[b]) > 0 ? formatMoney(d.buckets[b], symbol) : '—'}
                      </td>
                    ))}
                    <td className="text-small font-bold text-surface py-2 text-right">{formatMoney(d.total, symbol)}</td>
                  </tr>
                  {open === d.key
                    ? d.bills.map((b) => (
                        <tr key={b.folioId} className="border-b border-secondary/10 bg-secondary/5">
                          <td className="text-tiny text-surface py-2 pr-4 pl-4" colSpan={report.buckets.length}>
                            <Link href={`/dashboard/billing/${b.folioId}`} className="underline underline-offset-2">
                              {b.guestName}
                              {b.label ? ` — ${b.label}` : ''}
                            </Link>
                            {b.confirmationNumber ? ` · ${b.confirmationNumber}` : ''}
                            {b.invoice ? ` · ${b.invoice.number}` : ' · not invoiced'}
                            {` · ${b.ageDays} day${b.ageDays === 1 ? '' : 's'} since ${formatDateOnly(b.since)}`}
                            {b.invoice?.dueDate ? <span className={b.overdue ? 'text-red-600 font-semibold' : ''}>{` · due ${formatDateOnly(b.invoice.dueDate)}${b.overdue ? ' (overdue)' : ''}`}</span> : null}
                          </td>
                          <td className="text-tiny text-surface py-2 text-right">{formatMoney(b.balance, symbol)}</td>
                        </tr>
                      ))
                    : null}
                </Fragment>
              ))}
              <tr>
                <td className="text-small font-bold text-surface pt-2 pr-4">Total</td>
                {report.buckets.map((b) => (
                  <td key={b} className="text-small font-bold text-surface pt-2 pr-4 text-right">
                    {formatMoney(report.totals[b], symbol)}
                  </td>
                ))}
                <td className="text-small font-bold text-surface pt-2 text-right">{formatMoney(report.totals.total, symbol)}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}
    </Section>
  );
}
