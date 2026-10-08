'use client';

import Link from 'next/link';
import { Suspense, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { RefundsIcon } from '@/components/ui/Icons';
import { ApiError } from '@/lib/api';
import { useCorrectLineItemMutation, useFolioQuery, useFoliosQuery, type FolioDetail, type LineItem } from '@/lib/folios';
import { REFUND_METHOD_OPTIONS, useRefundActionMutation, useRefundsQuery, useRequestRefundMutation, type Refund, type RefundMethod } from '@/lib/refunds';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { isSupervisorAtBranch, mayActAtBranch } from '@/lib/roles';
import { useAuthStore } from '@/lib/store/authStore';
import { formatDateOnly } from '@/lib/dates';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

const METHOD_LABEL: Record<string, string> = { cash: 'Cash', card: 'Card', bank_transfer: 'Bank transfer', voucher: 'Voucher', loyalty_points: 'Points' };

function billName(f: { guest: { name: string }; label: string | null; reservation: { confirmationNumber: string; room: { number: string } | null } | null }): string {
  const room = f.reservation?.room ? ` — Room ${f.reservation.room.number}` : '';
  const conf = f.reservation ? ` · ${f.reservation.confirmationNumber}` : '';
  return `${f.guest.name}${room}${conf}${f.label ? ` (${f.label})` : ''}`;
}

/**
 * Refunds & Corrections (ref: "Process refunds with approval workflow") —
 * the two ways money comes off a bill. A **correction** takes a charge that
 * shouldn't be there off the bill, with its tax (owner, manager or
 * accountant — the backend's roles). A **refund** hands back credit — what
 * a guest paid beyond what they owe — through the reference's manager gate:
 * the desk asks, a manager approves (their own requests need no second
 * approval), and whoever hands the money over pays it out, as a negative
 * payment; cash comes out of their drawer.
 *
 * `?folio=` opens a bill straight away — the Guest Folio page links here.
 */
export default function RefundsPage() {
  return (
    // useSearchParams needs a Suspense boundary under the App Router.
    <Suspense fallback={null}>
      <RefundsAndCorrections />
    </Suspense>
  );
}

function RefundsAndCorrections() {
  const params = useSearchParams();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [search, setSearch] = useState('');
  const [folioId, setFolioId] = useState<string | null>(params.get('folio'));
  const [rejecting, setRejecting] = useState<Refund | null>(null);
  const [payingOut, setPayingOut] = useState<Refund | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refundsQuery = useRefundsQuery(activeBranchId, auth);
  const foliosQuery = useFoliosQuery(activeBranchId, 'all', auth);
  const folioQuery = useFolioQuery(folioId, auth);
  const actionMutation = useRefundActionMutation(activeBranchId ?? '', auth);

  const refunds = useMemo(() => refundsQuery.data ?? [], [refundsQuery.data]);
  const pending = refunds.filter((r) => r.status === 'pending');
  const approved = refunds.filter((r) => r.status === 'approved');
  const done = refunds.filter((r) => r.status === 'processed' || r.status === 'rejected').slice(0, 50);

  const billOptions: SelectOption[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (foliosQuery.data ?? [])
      .filter((f) => !q || [f.guest.name, f.reservation?.room?.number ?? '', f.reservation?.confirmationNumber ?? '', f.label ?? ''].some((v) => v.toLowerCase().includes(q)))
      .map((f) => {
        const balance = Number(f.balanceDue);
        const symbol = currencySymbolFor(f.currency);
        const state = balance < 0 ? ` — ${formatMoney(-balance, symbol)} in credit` : balance > 0 ? ` — owes ${formatMoney(balance, symbol)}` : ' — settled up';
        return { value: f.id, label: `${billName(f)}${state}` };
      });
  }, [foliosQuery.data, search]);

  if (!activeBranchId || !user) return null;
  const canApprove = isSupervisorAtBranch(user, activeBranchId);
  const canHandle = mayActAtBranch(user, activeBranchId, ['owner', 'manager', 'front_desk', 'accountant']);
  const canCorrect = mayActAtBranch(user, activeBranchId, ['owner', 'manager', 'accountant']);

  async function act(refund: Refund, action: 'approve' | 'reject' | 'pay-out', reason?: string) {
    setError(null);
    setNotice(null);
    try {
      await actionMutation.mutateAsync({ refund, action, reason });
      const amount = formatMoney(refund.amount, currencySymbolFor(refund.currency));
      setNotice(
        action === 'approve'
          ? `Approved ${amount} for ${refund.folio.guest.name} — it can be paid out now.`
          : action === 'reject'
            ? `Turned down ${amount} for ${refund.folio.guest.name}.`
            : `Paid out ${amount} to ${refund.folio.guest.name} by ${METHOD_LABEL[refund.method].toLowerCase()} — it's on the bill as a refund.`,
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader
        icon={<RefundsIcon className="size-8" />}
        title="Refunds & Corrections"
        subtitle="Take a charge off a bill, or hand a guest's credit back — with a manager's approval."
        roles="Front Desk · Manager · Accountant"
      />

      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {notice ? (
        <Card tone="secondary">
          <p className="text-small text-surface">{notice}</p>
        </Card>
      ) : null}

      <Section label="Waiting for Approval">
        {pending.length === 0 ? (
          <p className="text-body text-surface-muted">No refunds waiting for a manager.</p>
        ) : (
          <RefundList
            refunds={pending}
            actions={(r) =>
              canApprove ? (
                <>
                  <Button type="button" size="sm" onClick={() => act(r, 'approve')} loading={actionMutation.isPending && actionMutation.variables?.refund.id === r.id}>
                    Approve
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setRejecting(r)}>
                    Turn Down
                  </Button>
                </>
              ) : (
                <span className="text-tiny text-surface-muted">A manager approves this</span>
              )
            }
          />
        )}
      </Section>

      <Section label="Approved — Ready to Pay Out">
        {approved.length === 0 ? (
          <p className="text-body text-surface-muted">Nothing approved and waiting to be handed over.</p>
        ) : (
          <RefundList
            refunds={approved}
            actions={(r) => (
              <>
                {canHandle ? (
                  <Button type="button" size="sm" onClick={() => setPayingOut(r)}>
                    Pay Out
                  </Button>
                ) : null}
                {canApprove ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => setRejecting(r)}>
                    Turn Down
                  </Button>
                ) : null}
              </>
            )}
          />
        )}
      </Section>

      <Section label="Correct or Refund a Bill">
        <SearchInput label="Search bills" placeholder="Guest, room or confirmation #" value={search} onChange={setSearch} />
        <Select id="refund-bill" name="folioId" label="Bill" options={billOptions} value={folioId} onChange={setFolioId} />
        {folioId && folioQuery.data ? (
          <BillPanel
            key={folioQuery.data.id}
            folio={folioQuery.data}
            refunds={refunds.filter((r) => r.folioId === folioId)}
            branchId={activeBranchId}
            auth={auth}
            canCorrect={canCorrect}
            canRequest={canHandle}
            onDone={(message) => {
              setError(null);
              setNotice(message);
            }}
            onError={setError}
          />
        ) : folioId && folioQuery.isLoading ? (
          <p className="text-body text-surface-muted">Loading…</p>
        ) : null}
      </Section>

      <Section label="Recent Refunds">
        {done.length === 0 ? (
          <p className="text-body text-surface-muted">No refunds paid out or turned down yet.</p>
        ) : (
          <RefundList refunds={done} actions={() => null} />
        )}
      </Section>

      <RejectDialog
        refund={rejecting}
        onCancel={() => setRejecting(null)}
        onConfirm={(reason) => {
          const refund = rejecting;
          setRejecting(null);
          if (refund) void act(refund, 'reject', reason);
        }}
      />
      <ConfirmDialog
        open={payingOut !== null}
        title="Pay out this refund?"
        description={
          payingOut
            ? `Hand ${formatMoney(payingOut.amount, currencySymbolFor(payingOut.currency))} back to ${payingOut.folio.guest.name} by ${METHOD_LABEL[payingOut.method].toLowerCase()}. It goes on the bill as a refund${payingOut.method === 'cash' ? ', and the cash comes out of your drawer' : ''}.`
            : ''
        }
        confirmLabel="Pay Out"
        onConfirm={() => {
          const refund = payingOut;
          setPayingOut(null);
          if (refund) void act(refund, 'pay-out');
        }}
        onCancel={() => setPayingOut(null)}
      />
    </Container>
  );
}

function RefundList({ refunds, actions }: { refunds: Refund[]; actions: (r: Refund) => ReactNode }) {
  return (
    <ul className="flex flex-col gap-3">
      {refunds.map((r) => {
        const symbol = currencySymbolFor(r.currency);
        return (
          <li key={r.id}>
            <Card tone="secondary" className="flex flex-col gap-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1 min-w-0">
                  <Link href={`/dashboard/billing/${r.folioId}`} className="text-small font-bold text-surface underline underline-offset-2">
                    {billName(r.folio)}
                  </Link>
                  <p className="text-tiny text-surface-muted">
                    Asked {new Date(r.createdAt).toLocaleString()} by {r.requestedByUser?.name ?? 'Unknown'}
                    {r.approvedByUser ? ` · approved by ${r.approvedByUser.name}` : ''}
                    {r.processedByUser && r.processedAt ? ` · paid out by ${r.processedByUser.name}, ${new Date(r.processedAt).toLocaleString()}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-body font-semibold text-surface">{formatMoney(r.amount, symbol)}</span>
                  <span className="inline-flex rounded-pill bg-primary/15 px-2 py-0.5 text-tiny font-semibold text-primary-dark">{METHOD_LABEL[r.method]}</span>
                  {r.status === 'processed' ? <span className="inline-flex rounded-pill bg-green-100 px-2 py-0.5 text-tiny font-semibold text-green-800">Paid out</span> : null}
                  {r.status === 'rejected' ? <span className="inline-flex rounded-pill bg-red-100 px-2 py-0.5 text-tiny font-semibold text-red-800">Turned down</span> : null}
                  {actions(r)}
                </div>
              </div>
              <p className="text-small text-surface">Reason: {r.reason}</p>
              {r.payment ? (
                <p className="text-tiny text-surface-muted">
                  Against the {METHOD_LABEL[r.payment.method].toLowerCase()} payment of {formatMoney(r.payment.amount, symbol)} on {new Date(r.payment.recordedAt).toLocaleDateString()}
                </p>
              ) : null}
              {r.rejectionReason ? <p className="text-small text-red-700">Turned down: {r.rejectionReason}</p> : null}
            </Card>
          </li>
        );
      })}
    </ul>
  );
}

/** The picked bill: its charges to correct, and its credit to refund. */
function BillPanel({
  folio,
  refunds,
  branchId,
  auth,
  canCorrect,
  canRequest,
  onDone,
  onError,
}: {
  folio: FolioDetail;
  refunds: Refund[];
  branchId: string;
  auth: AuthOpts;
  canCorrect: boolean;
  canRequest: boolean;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const symbol = currencySymbolFor(folio.currency);
  const balance = Number(folio.totals.balanceDue);
  const onTheirWay = refunds.filter((r) => r.status === 'pending' || r.status === 'approved').reduce((sum, r) => sum + Number(r.amount), 0);
  const refundable = Math.max(0, -balance - onTheirWay);
  const settled = folio.status === 'settled';

  const [correcting, setCorrecting] = useState<LineItem | null>(null);
  const correctMutation = useCorrectLineItemMutation(branchId, folio.id, auth);

  const correctedIds = new Set(folio.lineItems.map((li) => li.correctsLineItemId).filter((id): id is string => id !== null));
  const correctable = folio.lineItems.filter((li) => !li.isVoid && li.chargeType !== 'correction' && !li.correctsLineItemId);

  return (
    <div className="flex flex-col gap-6">
      <Card tone="accent" className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-4">
          <span className="text-small text-accent-dark">{balance < 0 ? 'Credit due to the guest' : 'Balance due'}</span>
          <span className={`text-body font-semibold ${balance < 0 ? 'text-green-700' : 'text-surface'}`}>{formatMoney(Math.abs(balance), symbol)}</span>
        </div>
        {onTheirWay > 0 ? (
          <div className="flex items-center justify-between gap-4">
            <span className="text-small text-accent-dark">Refunds already on their way</span>
            <span className="text-body font-semibold text-surface">{formatMoney(onTheirWay, symbol)}</span>
          </div>
        ) : null}
        <Link href={`/dashboard/billing/${folio.id}`} className="text-tiny text-surface underline underline-offset-2 self-start">
          Open the bill
        </Link>
      </Card>

      <div className="flex flex-col gap-3">
        <h3 className="text-body font-bold text-surface">Correct a Charge</h3>
        {settled ? (
          <p className="text-small text-surface-muted">This bill is settled — nothing on it can be corrected.</p>
        ) : correctable.length === 0 ? (
          <p className="text-small text-surface-muted">Nothing has been charged to this bill.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-primary/25">
                  <th className="text-small font-bold text-surface pb-2 pr-4">Date</th>
                  <th className="text-small font-bold text-surface pb-2 pr-4">Charge</th>
                  <th className="text-small font-bold text-surface pb-2 pr-4 text-right">Amount</th>
                  <th className="text-small font-bold text-surface pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {correctable.map((li) => (
                  <tr key={li.id} className="border-b border-primary/15 last:border-0">
                    <td className="text-small text-surface py-3 pr-4 whitespace-nowrap">{li.serviceDate ? formatDateOnly(li.serviceDate) : '—'}</td>
                    <td className={`text-small py-3 pr-4 ${li.chargeType === 'tax' ? 'text-surface-muted' : 'text-surface'}`}>{li.description}</td>
                    <td className="text-small text-surface py-3 pr-4 text-right whitespace-nowrap">{formatMoney(li.amount, symbol)}</td>
                    <td className="py-3 text-right">
                      {correctedIds.has(li.id) ? (
                        <span className="text-tiny text-surface-muted">Corrected</span>
                      ) : canCorrect ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => setCorrecting(li)}>
                          Correct
                        </Button>
                      ) : (
                        <span className="text-tiny text-surface-muted">Manager or accountant</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-body font-bold text-surface">Refund the Credit</h3>
        {refundable <= 0 ? (
          <p className="text-small text-surface-muted">
            {balance < 0
              ? 'All of the credit already has a refund on its way.'
              : "Nothing to refund — the guest hasn't paid more than they owe. If a charge shouldn't be there, correct it first; any payment it covered then shows here as credit."}
          </p>
        ) : canRequest ? (
          // Keyed on what's left: after a request the form starts again from the new figure.
          <RefundForm key={refundable} folio={folio} refundable={refundable} branchId={branchId} auth={auth} onDone={onDone} onError={onError} />
        ) : null}
      </div>

      <CorrectDialog
        item={correcting}
        symbol={symbol}
        taxLines={correcting ? folio.lineItems.filter((li) => li.parentLineItemId === correcting.id && !li.isVoid && !correctedIds.has(li.id)) : []}
        pending={correctMutation.isPending}
        onCancel={() => setCorrecting(null)}
        onConfirm={async (reason) => {
          if (!correcting) return;
          try {
            await correctMutation.mutateAsync({ lineItemId: correcting.id, reason });
            onDone(`Corrected "${correcting.description}" — it's off the bill${correcting.chargeType === 'tax' ? '' : ', with its tax'}.`);
            setCorrecting(null);
          } catch (e) {
            onError(e instanceof ApiError ? e.message : 'Could not correct the charge.');
            setCorrecting(null);
          }
        }}
      />
    </div>
  );
}

function RefundForm({
  folio,
  refundable,
  branchId,
  auth,
  onDone,
  onError,
}: {
  folio: FolioDetail;
  refundable: number;
  branchId: string;
  auth: AuthOpts;
  onDone: (message: string) => void;
  onError: (message: string) => void;
}) {
  const symbol = currencySymbolFor(folio.currency);
  const requestMutation = useRequestRefundMutation(branchId, auth);
  const payments = folio.payments.filter((p) => !p.isVoid && Number(p.amount) > 0 && p.method !== 'loyalty_points' && p.method !== 'voucher');
  const [amount, setAmount] = useState<number | undefined>(refundable);
  const [paymentId, setPaymentId] = useState('');
  const [method, setMethod] = useState<RefundMethod | ''>('');
  const [reason, setReason] = useState('');

  const payment = payments.find((p) => p.id === paymentId);
  const effectiveMethod = method || (payment?.method as RefundMethod | undefined) || '';
  const paymentOptions: SelectOption[] = [
    { value: '', label: 'No particular payment' },
    ...payments.map((p) => ({ value: p.id, label: `${METHOD_LABEL[p.method]} — ${formatMoney(p.amount, symbol)}, ${new Date(p.recordedAt).toLocaleDateString()}${p.reference ? ` (${p.reference})` : ''}` })),
  ];
  const valid = amount !== undefined && amount > 0 && amount <= refundable + 0.004 && effectiveMethod !== '' && reason.trim().length > 0;

  async function submit() {
    if (!valid || amount === undefined) return;
    try {
      const refund = await requestMutation.mutateAsync({
        folioId: folio.id,
        amount,
        paymentId: paymentId || undefined,
        method: (method || undefined) as RefundMethod | undefined,
        reason: reason.trim(),
      });
      onDone(
        refund.status === 'approved'
          ? `Refund of ${formatMoney(amount, symbol)} approved — pay it out from "Approved — Ready to Pay Out".`
          : `Refund of ${formatMoney(amount, symbol)} asked for — a manager approves it next.`,
      );
      setReason('');
    } catch (e) {
      onError(e instanceof ApiError ? e.message : 'Could not ask for the refund.');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-small text-surface-muted">Up to {formatMoney(refundable, symbol)} can be refunded.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        <CurrencyInput label="Amount" name="refundAmount" value={amount} onChange={setAmount} hint={`The whole credit is ${formatMoney(refundable, symbol)}`} />
        <Select id="refund-payment" name="paymentId" label="Against payment (optional)" options={paymentOptions} value={paymentId} onChange={setPaymentId} />
        <Select
          id="refund-method"
          name="method"
          label="Pay back by"
          options={REFUND_METHOD_OPTIONS}
          value={effectiveMethod || null}
          onChange={(value) => setMethod(value as RefundMethod)}
          placeholder="Choose how"
          hint={payment && !method ? 'The way the payment came in' : undefined}
        />
        <Input label="Reason" name="refundReason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} hint="Required — kept on the refund" />
      </div>
      <Button type="button" onClick={submit} disabled={!valid} loading={requestMutation.isPending} className="self-start">
        Ask for Refund
      </Button>
    </div>
  );
}

function CorrectDialog({
  item,
  symbol,
  taxLines,
  pending,
  onCancel,
  onConfirm,
}: {
  item: LineItem | null;
  symbol: string;
  taxLines: LineItem[];
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const [reason, setReason] = useState('');
  const tax = taxLines.reduce((sum, li) => sum + Number(li.amount), 0);
  return (
    <Modal open={item !== null} onClose={onCancel} title="Correct this charge?">
      {item ? (
        <p className="text-body text-surface-muted">
          &ldquo;{item.description}&rdquo; — {formatMoney(item.amount, symbol)}
          {tax !== 0 ? ` and its ${formatMoney(tax, symbol)} tax` : ''} come off the bill. The charge stays on the record beside its correction.
        </p>
      ) : null}
      <Input label="Reason" name="correctionReason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} hint="Required — shown on the bill with the correction" />
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={!reason.trim()}
          loading={pending}
          onClick={() => {
            onConfirm(reason.trim());
            setReason('');
          }}
        >
          Correct
        </Button>
      </div>
    </Modal>
  );
}

function RejectDialog({ refund, onCancel, onConfirm }: { refund: Refund | null; onCancel: () => void; onConfirm: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <Modal open={refund !== null} onClose={onCancel} title="Turn this refund down?">
      {refund ? (
        <p className="text-body text-surface-muted">
          {formatMoney(refund.amount, currencySymbolFor(refund.currency))} for {refund.folio.guest.name} — nothing is paid out, and the credit stays on the bill.
        </p>
      ) : null}
      <Input label="Reason" name="rejectionReason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} hint="Required — the desk sees why" />
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="danger"
          disabled={!reason.trim()}
          onClick={() => {
            onConfirm(reason.trim());
            setReason('');
          }}
        >
          Turn Down
        </Button>
      </div>
    </Modal>
  );
}
