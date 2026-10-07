'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { TransferChargesIcon } from '@/components/ui/Icons';
import { ApiError } from '@/lib/api';
import { anchorOf, linesMovingWith, useFolioQuery, useFoliosQuery, useMoveChargesMutation, type FolioListRow, type LineItem } from '@/lib/folios';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { mayActAtBranch } from '@/lib/roles';
import { useAuthStore } from '@/lib/store/authStore';

/** Who the backend lets move charges onto another stay's bill (`POST /folios/:id/transfer`'s roles). */
const TRANSFER_ROLES = ['owner', 'manager', 'accountant'] as const;

/** "Ada Obi — Room 101 · RES-2026-00012 (Company)" — whose bill, which room, which stay, which of its bills. */
function folioName(f: Pick<FolioListRow, 'guest' | 'label' | 'reservation'>): string {
  const room = f.reservation?.room ? ` — Room ${f.reservation.room.number}` : '';
  const conf = f.reservation ? ` · ${f.reservation.confirmationNumber}` : '';
  return `${f.guest.name}${room}${conf}${f.label ? ` (${f.label})` : ''}`;
}

function matches(f: FolioListRow, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [f.guest.name, f.reservation?.room?.number ?? '', f.reservation?.confirmationNumber ?? '', f.label ?? ''].some((v) => v.toLowerCase().includes(q));
}

/**
 * Transfer Charges Between Folios (ref: Folio Transfer — "Room-to-room,
 * guest-to-corporate, shared room split"). Any open bill at the property
 * can receive: another of the stay's own bills (the split the front desk
 * makes), or another stay's — room 102 paying for room 101, a guest's room
 * nights to their company's bill — which is a manager's, the owner's or an
 * accountant's call. Picked charges, or everything on the bill.
 *
 * What moves is what the backend moves: each charge with its tax, its
 * correction and the correction's tax (`linesMovingWith`), so the preview's
 * balances are the ones the two bills will really show.
 */
export default function TransferChargesPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [sourceSearch, setSourceSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [sourceFolioId, setSourceFolioId] = useState<string | null>(null);
  const [targetFolioId, setTargetFolioId] = useState<string | null>(null);
  const [moveAll, setMoveAll] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const foliosQuery = useFoliosQuery(activeBranchId, 'all', auth);
  const sourceQuery = useFolioQuery(sourceFolioId, auth);
  const moveMutation = useMoveChargesMutation(activeBranchId ?? '', auth);

  const openFolios = useMemo(() => (foliosQuery.data ?? []).filter((f) => f.status !== 'settled'), [foliosQuery.data]);
  const source = sourceQuery.data;
  const sourceRow = openFolios.find((f) => f.id === sourceFolioId) ?? null;
  const targetRow = openFolios.find((f) => f.id === targetFolioId) ?? null;
  const sameStay = Boolean(sourceRow && targetRow && sourceRow.reservation?.id === targetRow.reservation?.id);
  const mayTransfer = activeBranchId ? mayActAtBranch(user, activeBranchId, TRANSFER_ROLES) : false;

  const sourceOptions: SelectOption[] = useMemo(
    () => openFolios.filter((f) => matches(f, sourceSearch)).map((f) => ({ value: f.id, label: folioName(f) })),
    [openFolios, sourceSearch],
  );
  // The stay's own other bills first — the commonest move — then everyone else's.
  const targetOptions: SelectOption[] = useMemo(() => {
    const others = openFolios.filter((f) => f.id !== sourceFolioId && matches(f, targetSearch));
    const ownStay = others.filter((f) => sourceRow && f.reservation?.id === sourceRow.reservation?.id);
    const elsewhere = others.filter((f) => !ownStay.includes(f));
    return [
      ...ownStay.map((f) => ({ value: f.id, label: `${folioName(f)} — this stay${f.label ? '' : ' (main bill)'}` })),
      ...elsewhere.map((f) => ({ value: f.id, label: folioName(f) })),
    ];
  }, [openFolios, sourceFolioId, sourceRow, targetSearch]);

  const items = useMemo(() => (source?.lineItems ?? []).filter((li) => !li.isVoid), [source]);
  const onThisBill = useMemo(() => new Set(items.map((li) => li.id)), [items]);
  /** Goes wherever its charge goes — a tax line or correction whose charge is on this bill. */
  const isAttached = (li: LineItem) => {
    const anchor = anchorOf(li);
    return anchor !== null && onThisBill.has(anchor);
  };
  const moving = useMemo(() => (moveAll ? items : linesMovingWith(items, selectedIds)), [moveAll, items, selectedIds]);
  const movingIds = useMemo(() => new Set(moving.map((li) => li.id)), [moving]);
  const movingTotal = moving.reduce((sum, li) => sum + Number(li.amount), 0);
  const symbol = currencySymbolFor(source?.currency);

  function pickSource(id: string) {
    setSourceFolioId(id);
    setTargetFolioId(null);
    setSelectedIds(new Set());
    setMoveAll(false);
    setNotice(null);
    setError(null);
  }

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const blockedForRole = Boolean(targetRow) && !sameStay && !mayTransfer;
  const canSubmit = Boolean(sourceFolioId && targetFolioId && moving.length > 0 && reason.trim()) && !blockedForRole;

  async function handleTransfer() {
    if (!sourceFolioId || !targetFolioId || !targetRow || !canSubmit) return;
    setError(null);
    setNotice(null);
    try {
      await moveMutation.mutateAsync({
        sourceFolioId,
        targetFolioId,
        sameStay,
        reason: reason.trim(),
        ...(moveAll ? { transferAll: true } : { lineItemIds: [...selectedIds] }),
      });
      setNotice(`Moved ${moving.length} line${moving.length === 1 ? '' : 's'} (${formatMoney(movingTotal, symbol)}) to ${folioName(targetRow)}.`);
      setSelectedIds(new Set());
      setMoveAll(false);
      setReason('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not move the charges.');
    }
  }

  if (!activeBranchId) return null;

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader
        icon={<TransferChargesIcon className="size-8" />}
        title="Transfer Charges"
        subtitle="Room-to-room, guest-to-company, or between a stay's own bills."
        roles="Front Desk · Manager · Accountant"
      />

      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {notice ? (
        <Card tone="secondary">
          <p className="text-small text-surface">{notice}</p>
        </Card>
      ) : null}

      <Section label="Bills">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-body font-bold text-surface">From</h3>
              <p className="text-small text-surface-muted">The bill the charges are on now</p>
            </div>
            <SearchInput label="Search bills to move charges from" placeholder="Guest, room or confirmation #" value={sourceSearch} onChange={setSourceSearch} />
            <Select id="source-folio" name="sourceFolio" label="Source bill" options={sourceOptions} value={sourceFolioId} onChange={pickSource} />
            {sourceRow ? <BalanceCard title="Balance now" amount={sourceRow.balanceDue} after={Number(sourceRow.balanceDue) - movingTotal} symbol={symbol} /> : null}
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-body font-bold text-surface">To</h3>
              <p className="text-small text-surface-muted">Any open bill at this property</p>
            </div>
            {!sourceFolioId ? (
              <p className="text-small text-surface-muted">Pick the bill to move charges from first.</p>
            ) : (
              <>
                <SearchInput label="Search bills to move charges to" placeholder="Guest, room or confirmation #" value={targetSearch} onChange={setTargetSearch} />
                <Select id="target-folio" name="targetFolio" label="Destination bill" options={targetOptions} value={targetFolioId} onChange={setTargetFolioId} />
                {targetRow ? <BalanceCard title="Balance now" amount={targetRow.balanceDue} after={Number(targetRow.balanceDue) + movingTotal} symbol={symbol} /> : null}
                {blockedForRole ? (
                  <p className="text-small text-red-600">
                    Moving charges onto another guest&apos;s bill is for a manager, the owner or an accountant. Within one stay, you can move them here.
                  </p>
                ) : null}
              </>
            )}
          </div>
        </div>
      </Section>

      {source ? (
        <Section label="Charges">
          {items.length === 0 ? (
            <p className="text-body text-surface-muted">Nothing has been charged to this bill.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-small font-semibold text-surface cursor-pointer">
                  <input type="checkbox" className="size-4 accent-primary cursor-pointer" checked={moveAll} onChange={(e) => setMoveAll(e.target.checked)} />
                  Move everything on this bill
                </label>
                {!moveAll ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setSelectedIds(new Set())} disabled={selectedIds.size === 0}>
                    Clear selection
                  </Button>
                ) : null}
              </div>
              <p className="text-small text-surface-muted max-w-2xl">
                A charge&apos;s tax and any correction to it go with it, so neither bill is left carrying part of a charge it doesn&apos;t have. Payments stay on
                the bill they were paid to.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-primary/25">
                      <th className="pb-2 pr-4 w-10" />
                      <th className="text-small font-bold text-surface pb-2 pr-4">Service Date</th>
                      <th className="text-small font-bold text-surface pb-2 pr-4">Description</th>
                      <th className="text-small font-bold text-surface pb-2 pr-4">Type</th>
                      <th className="text-small font-bold text-surface pb-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((li) => {
                      const locked = moveAll || isAttached(li);
                      return (
                        <tr key={li.id} className="border-b border-primary/15 last:border-0">
                          <td className="py-3 pr-4">
                            <input
                              type="checkbox"
                              checked={movingIds.has(li.id)}
                              disabled={locked}
                              onChange={() => toggle(li.id)}
                              aria-label={locked ? `${li.description} — moves with its charge` : `Move ${li.description}`}
                              className={`size-4 accent-primary ${locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                            />
                          </td>
                          <td className="text-small text-surface py-3 pr-4 whitespace-nowrap">{li.serviceDate ? new Date(li.serviceDate).toLocaleDateString() : '—'}</td>
                          <td className={`text-small py-3 pr-4 ${li.chargeType === 'tax' || li.chargeType === 'correction' ? 'text-surface-muted' : 'text-surface'}`}>
                            {li.description}
                            {!moveAll && isAttached(li) ? <span className="block text-tiny text-surface-muted">Moves with its charge</span> : null}
                          </td>
                          <td className="py-3 pr-4">
                            <span className="inline-flex rounded-pill bg-primary/15 px-2 py-0.5 text-tiny font-semibold text-primary-dark capitalize">
                              {li.chargeType === 'fnb' ? 'FnB' : li.chargeType}
                            </span>
                          </td>
                          <td className="text-small text-surface py-3 text-right whitespace-nowrap font-semibold">{formatMoney(li.amount, symbol)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start pt-2">
                <Card tone="secondary" className="flex flex-col gap-2">
                  <h3 className="text-body font-bold text-surface">Preview</h3>
                  <Row label="Lines moving" value={String(moving.length)} />
                  <Row label="Amount moving" value={formatMoney(movingTotal, symbol)} />
                  {sourceRow ? <Row label="From bill after" value={formatMoney(Number(sourceRow.balanceDue) - movingTotal, symbol)} /> : null}
                  {targetRow ? <Row label="To bill after" value={formatMoney(Number(targetRow.balanceDue) + movingTotal, symbol)} /> : null}
                  <p className="text-tiny text-surface-muted pt-1 border-t border-secondary/20">
                    Nothing is created or destroyed — the two bills together owe the same before and after.
                  </p>
                </Card>
                <div className="flex flex-col gap-3">
                  <Input label="Reason" name="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} hint="Required — kept on the transfer for audit" />
                  <Button type="button" disabled={!canSubmit} loading={moveMutation.isPending} onClick={handleTransfer} className="self-start">
                    Transfer Charges
                  </Button>
                </div>
              </div>
            </>
          )}
        </Section>
      ) : null}
    </Container>
  );
}

function BalanceCard({ title, amount, after, symbol }: { title: string; amount: string; after: number; symbol: string }) {
  const changed = Math.abs(after - Number(amount)) > 0.004;
  return (
    <Card tone="accent" className="flex flex-col gap-1">
      <Row label={title} value={formatMoney(amount, symbol)} />
      {changed ? <Row label="After the transfer" value={formatMoney(after, symbol)} /> : null}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-small text-surface-muted">{label}</span>
      <span className="text-small font-semibold text-surface">{value}</span>
    </div>
  );
}
