'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api';
import { formatDateOnly, formatMomentDate } from '@/lib/dates';
import { downloadInvoice, useInvoicesQuery, useIssueInvoiceMutation, type Invoice } from '@/lib/folios';
import { formatMoney } from '@/lib/numberFormat';

/**
 * A bill's invoices: issue one for the bill as it stands, and download any.
 * Issuing again when nothing has changed gives the same invoice back;
 * after a change, a new number replaces the old one, which stays listed and
 * marked replaced.
 */
export function InvoicesCard({
  folioId,
  symbol,
  canIssue,
  pending,
  auth,
}: {
  folioId: string;
  symbol: string;
  canIssue: boolean;
  /** The bill only holds a deposit until the guest arrives — nothing to invoice yet. */
  pending: boolean;
  auth: { accessToken: string | undefined; tenantId: string | undefined };
}) {
  const invoicesQuery = useInvoicesQuery(folioId, auth);
  const issueMutation = useIssueInvoiceMutation(folioId, auth);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  async function issue() {
    setError(null);
    try {
      const invoice = await issueMutation.mutateAsync();
      await download(invoice);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  async function download(invoice: Invoice) {
    setDownloading(invoice.id);
    try {
      await downloadInvoice(invoice, auth);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not download the invoice.');
    } finally {
      setDownloading(null);
    }
  }

  const invoices = invoicesQuery.data ?? [];
  return (
    <div className="flex flex-col gap-3">
      {pending ? <p className="text-small text-surface-muted">This bill holds a deposit until the guest arrives — it can be invoiced once the stay begins.</p> : null}
      {canIssue && !pending ? (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={issue} loading={issueMutation.isPending}>
          {invoices.some((i) => !i.supersededAt) ? 'Issue Updated Invoice' : 'Issue Invoice'}
        </Button>
      ) : null}
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {invoices.length === 0 ? (
        <p className="text-body text-surface-muted">No invoice has been issued for this bill.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-primary/15 pb-2 last:border-0">
              <div className="flex flex-col">
                <span className={`text-small font-semibold ${invoice.supersededAt ? 'text-surface-muted line-through' : 'text-surface'}`}>{invoice.number}</span>
                <span className="text-tiny text-surface-muted">
                  Issued {formatMomentDate(invoice.issuedAt, { day: 'numeric', month: 'short', year: 'numeric' })} · {formatMoney(invoice.totals.total, symbol)}
                  {invoice.dueDate ? ` · due ${formatDateOnly(invoice.dueDate)}` : ''}
                  {invoice.supersededBy ? ` · replaced by ${invoice.supersededBy.number}` : ''}
                </span>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => download(invoice)} loading={downloading === invoice.id}>
                Download PDF
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
