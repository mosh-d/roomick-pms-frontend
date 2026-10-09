'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { BackButton } from '@/components/ui/BackButton';
import { ForwardButton } from '@/components/ui/ForwardButton';
import { ReceiptIcon } from '@/components/ui/Icons';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ApiError } from '@/lib/api';
import { useFolioQuery, useTaxBreakdownQuery, useCloseFolioMutation, useReopenFolioMutation, type LineItem } from '@/lib/folios';
import { Modal } from '@/components/ui/Modal';
import { Textarea } from '@/components/ui/Textarea';
import { isSupervisorAtBranch, mayActAtBranch } from '@/lib/roles';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { useAuthStore } from '@/lib/store/authStore';
import { PostChargeForm } from './_components/PostChargeForm';
import { RecordPaymentForm } from './_components/RecordPaymentForm';
import { RedeemPointsCard } from './_components/RedeemPointsCard';
import { PaymentsList } from './_components/PaymentsList';
import { InvoicesCard } from './_components/InvoicesCard';
import { formatDateOnly } from '@/lib/dates';

/**
 * Guest Folio (Roomick-UI.pdf page 33) — guest details, the line-item
 * ledger with its running totals, the per-rule tax breakdown, and the two
 * forms that move money.
 *
 * Payments received are listed (a supervisor can void one recorded in
 * error), and the bill can be invoiced — a numbered PDF.
 *
 * Deferred from the reference and named rather than faked: Send
 * Email (the comms module is stubbed — `communication_log` rows only),
 * per-charge tax-rule pickers (rules already declare which charge types
 * they apply to, so the engine picks them), and Split Billing / Refunds &
 * Corrections (their own pages, ref p34 — linked from the balance).
 */
export default function GuestFolioPage() {
  const params = useParams<{ folioId: string }>();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [confirmClose, setConfirmClose] = useState(false);
  const [closeError, setCloseError] = useState<string | null>(null);

  const folioQuery = useFolioQuery(params.folioId, auth);
  const taxQuery = useTaxBreakdownQuery(params.folioId, auth);
  const closeMutation = useCloseFolioMutation(activeBranchId ?? '', params.folioId, auth);
  const reopenMutation = useReopenFolioMutation(activeBranchId ?? '', params.folioId, auth);
  const [reopening, setReopening] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [reopenError, setReopenError] = useState<string | null>(null);

  async function handleReopen() {
    setReopenError(null);
    try {
      await reopenMutation.mutateAsync(reopenReason.trim());
      setReopening(false);
      setReopenReason('');
    } catch (error) {
      setReopenError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
    }
  }

  const folio = folioQuery.data;

  async function handleClose() {
    setCloseError(null);
    try {
      await closeMutation.mutateAsync();
      setConfirmClose(false);
    } catch (error) {
      setCloseError(error instanceof ApiError ? error.message : 'Something went wrong. Please try again.');
      setConfirmClose(false);
    }
  }

  if (!activeBranchId) return null;

  if (folioQuery.isLoading) {
    return (
      <Container className="max-w-6xl py-10">
        <p className="text-body text-surface-muted">Loading folio…</p>
      </Container>
    );
  }
  if (folioQuery.isError || !folio) {
    return (
      <Container className="max-w-6xl py-10">
        <p className="text-body text-red-600">Could not load this folio.</p>
      </Container>
    );
  }

  const balance = Number(folio.totals.balanceDue);
  const isSettled = folio.status === 'settled';
  const symbol = currencySymbolFor(folio.currency);
  // Deposits are payments too; shown on their own line, the rest under "Payments".
  const otherPayments = Number(folio.totals.paymentsTotal) - Number(folio.totals.depositsTotal);

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <BackButton fallbackHref="/dashboard/billing/folios" />
        <ForwardButton />
      </div>
      <PageHeader
        icon={<ReceiptIcon className="size-8" />}
        title="Guest Folio"
        subtitle="Live charges, line items, running balance"
        actions={
          isSettled ? (
            <div className="flex items-center gap-2">
              <span className="inline-flex rounded-pill bg-status-inspected px-3 py-1 text-small font-semibold text-white">Settled</span>
              {/* A charge found after the bill closed — the minibar after check-out — needs the bill open again. */}
              {isSupervisorAtBranch(user, activeBranchId) ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setReopening(true)}>
                  Reopen Bill
                </Button>
              ) : null}
            </div>
          ) : (
            <Button type="button" variant="outline" size="sm" disabled={balance > 0} onClick={() => setConfirmClose(true)}>
              Close Folio
            </Button>
          )
        }
      />

      {closeError ? <p className="text-small text-red-600">{closeError}</p> : null}
      {folio.guestStatus === 'deposit_held' ? (
        <Card tone="accent">
          <p className="text-small text-surface">
            <span className="font-bold">Deposit held.</span> The guest hasn&apos;t arrived yet: the {formatMoney(Math.abs(balance), symbol)} on this bill goes
            towards the stay when they check in.
          </p>
        </Card>
      ) : null}
      {folio.guestStatus === 'city_ledger' ? (
        <Card tone="accent">
          <p className="text-small text-surface">
            <span className="font-bold">City Ledger receivable.</span> This guest has checked out and still owes {formatMoney(folio.totals.balanceDue, symbol)}. Collections
            matter — check-out is never blocked on a balance.
          </p>
        </Card>
      ) : null}

      <Section label="Guest Details" tone="accent">
        <Row label="Name" value={folio.guest.name} />
        <Row label="Email" value={folio.guest.email ?? 'NIL'} />
        <Row label="Phone Number" value={folio.guest.phone ?? 'NIL'} />
        <Row label="Room" value={folio.reservation?.room?.number ?? 'NIL'} />
        <Row label="Confirmation #" value={folio.reservation?.confirmationNumber ?? 'NIL'} />
      </Section>

      <Section label="Line Items">
        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 items-start">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-primary/25">
                  <th className="text-small font-bold text-surface pb-2 pr-4">Service Date</th>
                  <th className="text-small font-bold text-surface pb-2 pr-4">Description</th>
                  <th className="text-small font-bold text-surface pb-2 pr-4">Charge Type</th>
                  <th className="text-small font-bold text-surface pb-2 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {folio.lineItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="text-small text-surface-muted py-3">
                      Nothing posted to this folio yet.
                    </td>
                  </tr>
                ) : (
                  folio.lineItems.map((item) => <LineItemRow key={item.id} item={item} symbol={symbol} />)
                )}
              </tbody>
            </table>
          </div>

          <Card tone="secondary" className="flex flex-col gap-2">
            <TotalRow label="Sub Total" value={folio.totals.subTotal} symbol={symbol} />
            <TotalRow label="Tax" value={folio.totals.taxTotal} symbol={symbol} />
            <TotalRow label="Total Cost" value={folio.totals.totalCost} symbol={symbol} />
            {Number(folio.totals.depositsTotal) > 0 ? (
              <TotalRow label="Deposit Applied" value={`-${folio.totals.depositsTotal}`} symbol={symbol} />
            ) : null}
            <TotalRow label="Payments" value={`-${otherPayments.toFixed(2)}`} symbol={symbol} />
            {folio.reservation ? (
              <div className="flex items-center justify-between gap-2 pt-2 border-t border-secondary/20">
                <span className="text-small text-surface-muted">Projected stay total</span>
                <span className="text-small text-surface-muted">{formatMoney(folio.reservation.confirmedRate, symbol)}</span>
              </div>
            ) : null}
            <div className="pt-3 mt-1 border-t border-secondary/20">
              <p className="text-small text-surface-muted mb-1">{balance < 0 ? 'Credit due to guest' : 'Balance Due'}</p>
              <p className={`text-title font-bold ${balance > 0 ? 'text-red-600' : balance < 0 ? 'text-green-700' : 'text-surface'}`}>
                {formatMoney(Math.abs(balance), symbol)}
              </p>
              <p className="text-tiny text-surface-muted mt-1">Full folio balance</p>
              <Link href={`/dashboard/billing/refunds?folio=${folio.id}`} className="text-tiny text-surface underline underline-offset-2 mt-2 inline-block">
                {balance < 0 ? 'Refund the credit' : 'Correct a charge'}
              </Link>
            </div>
          </Card>
        </div>
      </Section>

      <Section label="Payments Received">
        <PaymentsList
          payments={folio.payments}
          branchId={activeBranchId}
          folioId={params.folioId}
          symbol={symbol}
          canVoid={!isSettled && mayActAtBranch(user, activeBranchId, ['owner', 'manager', 'accountant'])}
          auth={auth}
        />
      </Section>

      <Section label="Invoices">
        <InvoicesCard
          folioId={params.folioId}
          symbol={symbol}
          canIssue={mayActAtBranch(user, activeBranchId, ['owner', 'manager', 'front_desk', 'accountant'])}
          pending={folio.status === 'pending'}
          auth={auth}
        />
      </Section>

      <Section label="Tax Breakdown">
        {taxQuery.data && taxQuery.data.rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-primary/25">
                  <th className="text-small font-bold text-surface pb-2 pr-4">Tax Type</th>
                  <th className="text-small font-bold text-surface pb-2 pr-4 text-right">Taxable Base</th>
                  <th className="text-small font-bold text-surface pb-2 text-right">Tax Collected</th>
                </tr>
              </thead>
              <tbody>
                {taxQuery.data.rows.map((row) => (
                  <tr key={row.ruleId} className="border-b border-primary/15 last:border-0">
                    <td className="py-3 pr-4">
                      <span className="inline-flex rounded-pill bg-primary/15 px-2 py-0.5 text-tiny font-semibold text-primary-dark">{row.ruleName}</span>
                      <span className="text-small text-surface-muted ml-2">
                        ({row.type === 'fixed' ? `${formatMoney(row.fixedAmount ?? '0', symbol)} a charge` : `${Number((Number(row.rate) * 100).toFixed(2))}%`}
                        {row.inclusive ? ', included in prices' : ''})
                      </span>
                    </td>
                    <td className="text-small text-surface py-3 pr-4 text-right">{formatMoney(row.taxableBase, symbol)}</td>
                    <td className="text-small text-surface py-3 text-right">{formatMoney(row.taxCollected, symbol)}</td>
                  </tr>
                ))}
                <tr>
                  <td className="text-small font-bold text-surface py-3 pr-4" colSpan={2}>
                    Total Tax
                  </td>
                  <td className="text-small font-bold text-surface py-3 text-right">{formatMoney(taxQuery.data.totalTax, symbol)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-body text-surface-muted">No tax has been charged on this folio.</p>
        )}
      </Section>

      {!isSettled ? (
        <>
          <Section label="Add Charge">
            <PostChargeForm branchId={activeBranchId} folioId={params.folioId} auth={auth} />
          </Section>

          <Section label="Payment">
            <RedeemPointsCard folioId={params.folioId} guest={folio.guest} balanceDue={folio.totals.balanceDue} currencySymbol={symbol} auth={auth} />
            <RecordPaymentForm
              branchId={activeBranchId}
              folioId={params.folioId}
              auth={auth}
              balanceDue={folio.totals.balanceDue}
              currencySymbol={symbol}
            />
          </Section>
        </>
      ) : (
        <p className="text-body text-surface-muted">This folio is settled — no further charges or payments can be posted.</p>
      )}

      <Modal open={reopening} onClose={() => (reopenMutation.isPending ? undefined : setReopening(false))} title="Reopen this bill?">
        <p className="text-small text-surface-muted">It goes back to open so charges and payments can be posted to it again. Close it again once it&apos;s straight.</p>
        <Textarea id="reopen-reason" label="Reason" value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} maxLength={300} hint="Required — recorded in the audit trail with your name" />
        {reopenError ? <p className="text-small text-red-600">{reopenError}</p> : null}
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" onClick={() => setReopening(false)} disabled={reopenMutation.isPending}>
            Keep It Settled
          </Button>
          <Button type="button" onClick={handleReopen} loading={reopenMutation.isPending} disabled={reopenReason.trim().length < 3}>
            Reopen Bill
          </Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmClose}
        title="Close this folio?"
        description="Closing finalises the folio — no further charges or payments can be posted to it. Only possible at a zero or credit balance."
        confirmLabel="Close Folio"
        onCancel={() => setConfirmClose(false)}
        onConfirm={handleClose}
        loading={closeMutation.isPending}
      />
    </Container>
  );
}

/**
 * Tax rows are the engine's own ledger entries; a parent charge shows its tax as a "+X tax" suffix, matching the
 * reference's line list. A correction shows the tax it reversed the same way ("-X tax"), so staff can see the VAT
 * came off with the charge.
 */
function LineItemRow({ item, symbol }: { item: LineItem; symbol: string }) {
  const isTax = item.chargeType === 'tax';
  const isCredit = Number(item.amount) < 0;
  const tax = Number(item.taxAmount);
  return (
    <tr className="border-b border-primary/15 last:border-0">
      <td className="text-small text-surface py-3 pr-4 whitespace-nowrap">
        {item.serviceDate ? formatDateOnly(item.serviceDate) : '—'}
      </td>
      <td className={`text-small py-3 pr-4 ${isTax ? 'text-surface-muted' : 'text-surface'}`}>{item.description}</td>
      <td className="py-3 pr-4">
        <span className="inline-flex rounded-pill bg-primary/15 px-2 py-0.5 text-tiny font-semibold text-primary-dark capitalize">
          {item.chargeType === 'fnb' ? 'FnB' : item.chargeType}
        </span>
      </td>
      <td className={`text-small py-3 text-right whitespace-nowrap ${isCredit ? 'text-green-700' : 'text-surface'}`}>
        <span className="font-semibold">{formatMoney(item.amount, symbol)}</span>
        {!isTax && tax !== 0 ? (
          <span className="text-tiny text-surface-muted ml-2">
            {tax > 0 ? '+' : ''}
            {formatMoney(item.taxAmount, symbol)} tax
          </span>
        ) : null}
      </td>
    </tr>
  );
}

function TotalRow({ label, value, symbol }: { label: string; value: string; symbol: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-small text-surface">{label}</span>
      <span className="text-small text-surface">{formatMoney(value, symbol)}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-small text-accent-dark">{label}</span>
      <span className="text-body font-semibold text-surface">{value}</span>
    </div>
  );
}
