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
import { ReceiptIcon } from '@/components/ui/Icons';
import { ApiError } from '@/lib/api';
import {
  useFoliosQuery,
  useFolioQuery,
  useReservationFoliosQuery,
  useCreateFolioMutation,
  useSplitFolioMutation,
  type LineItem,
} from '@/lib/folios';
import { CHARGE_TYPE_OPTIONS } from '@/lib/schemas/folios';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * Split Billing (Roomick-UI.pdf page 34) — divide charges across a
 * reservation's folios (room to a company account, incidentals to the
 * guest, and so on).
 *
 * **Scope note, deliberate.** The reference offers three split methods:
 * Percentage, Fixed Amount, and Charge Type. Only Charge Type is
 * implemented, because it's the one the data model actually supports:
 * `FolioTransfer.lineItemIds` is documented in the schema as a "snapshot
 * of transferred line items", and the spec's own API surface says
 * "move selected line items to a new folio". Percentage and fixed-amount
 * splits don't move a charge — they'd have to *divide* one, which under
 * the append-only ledger rule ("no UPDATE of amounts") means posting
 * offsetting entries on both folios, a materially different operation
 * `FolioTransfer` doesn't model. Deferred rather than approximated.
 *
 * Selecting by charge type is exactly the reference's Charge Type mode:
 * filter, select all, move.
 *
 * A charge's tax lines (`parentLineItemId`) move with it — the backend
 * enforces that and refuses a split that would strand one. This page only
 * mirrors the rule, so the preview shows the amount that will really move.
 */
export default function SplitBillingPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [search, setSearch] = useState('');
  const [sourceFolioId, setSourceFolioId] = useState<string | null>(null);
  const [targetFolioId, setTargetFolioId] = useState<string | null>(null);
  const [chargeTypeFilter, setChargeTypeFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [reason, setReason] = useState('');
  const [newFolioLabel, setNewFolioLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const foliosQuery = useFoliosQuery(activeBranchId, 'all', auth);
  const sourceQuery = useFolioQuery(sourceFolioId, auth);
  const source = sourceQuery.data;
  const reservationId = source?.reservation?.id ?? null;

  const siblingsQuery = useReservationFoliosQuery(reservationId, auth);
  const createFolioMutation = useCreateFolioMutation(activeBranchId ?? '', reservationId ?? '', auth);
  const splitMutation = useSplitFolioMutation(activeBranchId ?? '', reservationId ?? '', auth);

  const folioOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (foliosQuery.data ?? [])
      .filter((f) => f.status !== 'settled')
      .filter((f) => !q || f.guest.name.toLowerCase().includes(q))
      // A split folio's own name keeps it apart from the guest's primary folio — otherwise both read "Guest — Room 101".
      .map((f) => ({
        value: f.id,
        label: `${f.guest.name}${f.label ? ` (${f.label})` : ''}${f.reservation?.room ? ` — Room ${f.reservation.room.number}` : ''}`,
      }));
  }, [foliosQuery.data, search]);

  /** Only other folios on the SAME reservation can receive a split — a different guest's bill is a transfer, which the backend rejects here. */
  const targetOptions: SelectOption[] = useMemo(
    () =>
      (siblingsQuery.data ?? [])
        .filter((f) => f.id !== sourceFolioId && f.status !== 'settled')
        .map((f) => ({ value: f.id, label: f.label ?? 'Primary folio' })),
    [siblingsQuery.data, sourceFolioId],
  );

  const movableItems = useMemo(() => {
    const items = source?.lineItems.filter((li) => !li.isVoid) ?? [];
    return chargeTypeFilter ? items.filter((li) => li.chargeType === chargeTypeFilter) : items;
  }, [source, chargeTypeFilter]);

  /** Charge id → the tax lines computed on it, which move with it rather than being picked on their own. */
  const taxByCharge = useMemo(() => {
    const map = new Map<string, LineItem[]>();
    for (const li of source?.lineItems ?? []) {
      const chargeId = isLinkedTax(li) ? li.parentLineItemId : null;
      if (li.isVoid || !chargeId) continue;
      map.set(chargeId, [...(map.get(chargeId) ?? []), li]);
    }
    return map;
  }, [source]);

  const pickedItems = useMemo(() => (source?.lineItems ?? []).filter((li) => selectedIds.has(li.id)), [source, selectedIds]);
  const taxMovingWith = useMemo(() => pickedItems.flatMap((li) => taxByCharge.get(li.id) ?? []), [pickedItems, taxByCharge]);

  const symbol = currencySymbolFor(source?.currency);
  const selectedTotal = useMemo(
    () => [...pickedItems, ...taxMovingWith].reduce((sum, li) => sum + Number(li.amount), 0),
    [pickedItems, taxMovingWith],
  );

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectSource(id: string) {
    setSourceFolioId(id);
    setTargetFolioId(null);
    setSelectedIds(new Set());
    setNotice(null);
  }

  async function handleCreateFolio() {
    if (!newFolioLabel.trim() || !reservationId) return;
    setError(null);
    try {
      const created = await createFolioMutation.mutateAsync(newFolioLabel.trim());
      setNewFolioLabel('');
      setTargetFolioId(created.id);
      setNotice(`Opened folio "${created.label ?? ''}" on this reservation.`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not open the folio.');
    }
  }

  async function handleSplit() {
    if (!sourceFolioId || !targetFolioId || selectedIds.size === 0 || !reason.trim()) return;
    setError(null);
    try {
      await splitMutation.mutateAsync({
        sourceFolioId,
        targetFolioId,
        lineItemIds: [...selectedIds],
        reason: reason.trim(),
      });
      const taxNote = taxMovingWith.length ? ` with ${taxMovingWith.length} tax line${taxMovingWith.length === 1 ? '' : 's'}` : '';
      setNotice(`Moved ${selectedIds.size} charge${selectedIds.size === 1 ? '' : 's'}${taxNote} (${formatMoney(selectedTotal, symbol)}).`);
      setSelectedIds(new Set());
      setReason('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not split the folio.');
    }
  }

  if (!activeBranchId) return null;

  const canSplit = Boolean(sourceFolioId && targetFolioId && selectedIds.size > 0 && reason.trim());

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader icon={<ReceiptIcon className="size-8" />} title="Split Billing" subtitle="Divide charges across multiple folios" />

      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {notice ? (
        <Card tone="secondary">
          <p className="text-small text-secondary">{notice}</p>
        </Card>
      ) : null}

      <Section label="Folio Selection">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-body font-bold text-primary-dark">From</h3>
              <p className="text-small text-primary-dark/70">The folio you want to move charges out of</p>
            </div>
            <SearchInput label="Search folios by guest name" placeholder="Search by guest name" value={search} onChange={setSearch} />
            <Select
              id="source-folio"
              name="sourceFolio"
              label="Source folio"
              options={folioOptions}
              value={sourceFolioId}
              onChange={selectSource}
            />
            {source ? (
              <Card tone="accent" className="flex flex-col gap-2">
                <DetailRow label="Name" value={source.guest.name} />
                <DetailRow label="Email" value={source.guest.email ?? 'NIL'} />
                <DetailRow label="Room" value={source.reservation?.room?.number ?? 'NIL'} />
                <DetailRow label="Balance" value={formatMoney(source.totals.balanceDue, symbol)} />
              </Card>
            ) : null}
          </div>

          <div className="flex flex-col gap-3">
            <div>
              <h3 className="text-body font-bold text-primary-dark">To</h3>
              <p className="text-small text-primary-dark/70">Another folio on the same reservation</p>
            </div>
            {!sourceFolioId ? (
              <p className="text-small text-primary-dark/70">Pick a source folio first.</p>
            ) : (
              <>
                <Select
                  id="target-folio"
                  name="targetFolio"
                  label="Destination folio"
                  options={targetOptions}
                  value={targetFolioId}
                  onChange={setTargetFolioId}
                />
                {targetOptions.length === 0 ? (
                  <p className="text-small text-primary-dark/70">
                    This reservation only has one folio. Open another below to split charges into it.
                  </p>
                ) : null}
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Input
                      label="New folio name"
                      value={newFolioLabel}
                      onChange={(e) => setNewFolioLabel(e.target.value)}
                      hint="e.g. Company account"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!newFolioLabel.trim()}
                    loading={createFolioMutation.isPending}
                    onClick={handleCreateFolio}
                  >
                    Open folio
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </Section>

      {source ? (
        <Section label="Bill Splitter">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <p className="text-small text-primary-dark/70 max-w-xl">
              Pick the charges to move. A charge&apos;s tax moves with it automatically, so neither bill is left carrying tax on a charge it
              doesn&apos;t have.
            </p>
            <div className="w-56">
              <Select
                id="charge-type-filter"
                name="chargeTypeFilter"
                label="Charge Type"
                options={[{ value: '', label: 'All charge types' }, ...CHARGE_TYPE_OPTIONS, { value: 'tax', label: 'Tax' }]}
                value={chargeTypeFilter}
                onChange={setChargeTypeFilter}
              />
            </div>
          </div>

          {movableItems.length === 0 ? (
            <p className="text-body text-primary-dark/70">No charges match this filter.</p>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds(new Set(movableItems.filter((li) => !isLinkedTax(li)).map((li) => li.id)))}
                >
                  Select all shown
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setSelectedIds(new Set())}>
                  Clear selection
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-primary/25">
                      <th className="pb-2 pr-4 w-10" />
                      <th className="text-small font-bold text-primary-dark pb-2 pr-4">Service Date</th>
                      <th className="text-small font-bold text-primary-dark pb-2 pr-4">Description</th>
                      <th className="text-small font-bold text-primary-dark pb-2 pr-4">Charge Type</th>
                      <th className="text-small font-bold text-primary-dark pb-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {movableItems.map((item) => {
                      const locked = isLinkedTax(item);
                      const checked = selectedIds.has(locked ? (item.parentLineItemId ?? '') : item.id);
                      return <SplitRow key={item.id} item={item} checked={checked} locked={locked} onToggle={toggle} symbol={symbol} />;
                    })}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start pt-2">
                <Card tone="secondary" className="flex flex-col gap-2">
                  <h3 className="text-body font-bold text-secondary">Preview</h3>
                  <DetailRow label="Charges selected" value={String(selectedIds.size)} />
                  {taxMovingWith.length > 0 ? (
                    <DetailRow label="Tax lines moving with them" value={String(taxMovingWith.length)} />
                  ) : null}
                  <DetailRow label="Amount moving" value={formatMoney(selectedTotal, symbol)} />
                  <div className="pt-2 border-t border-secondary/20 flex flex-col gap-2">
                    <DetailRow
                      label="Source balance after"
                      value={formatMoney(Number(source.totals.balanceDue) - selectedTotal, symbol)}
                    />
                    <p className="text-tiny text-secondary-light">
                      Nothing is created or destroyed — the combined balance across both folios is unchanged.
                    </p>
                  </div>
                </Card>

                <div className="flex flex-col gap-3">
                  <Input
                    label="Reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    hint="Required — recorded on the transfer for audit"
                  />
                  <Button type="button" disabled={!canSplit} loading={splitMutation.isPending} onClick={handleSplit} className="self-start">
                    Split Bill
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

/** A tax line tied to the charge it was computed on. Tax posted before the link existed has no parent and is still picked by hand. */
function isLinkedTax(item: LineItem): boolean {
  return item.chargeType === 'tax' && Boolean(item.parentLineItemId);
}

function SplitRow({
  item,
  checked,
  locked,
  onToggle,
  symbol,
}: {
  item: LineItem;
  checked: boolean;
  /** Linked tax line: mirrors its charge's checkbox and can't be picked on its own. */
  locked: boolean;
  onToggle: (id: string) => void;
  symbol: string;
}) {
  return (
    <tr className="border-b border-primary/15 last:border-0">
      <td className="py-3 pr-4">
        <input
          type="checkbox"
          checked={checked}
          disabled={locked}
          onChange={() => onToggle(item.id)}
          aria-label={locked ? `${item.description} — moves with its charge` : `Move ${item.description}`}
          className={`size-4 accent-primary ${locked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
        />
      </td>
      <td className="text-small text-primary-dark py-3 pr-4 whitespace-nowrap">
        {item.serviceDate ? new Date(item.serviceDate).toLocaleDateString() : '—'}
      </td>
      <td className={`text-small py-3 pr-4 ${item.chargeType === 'tax' ? 'text-primary-dark/70' : 'text-primary-dark'}`}>
        {item.description}
        {locked ? <span className="block text-tiny text-primary-dark/60">Moves with its charge</span> : null}
      </td>
      <td className="py-3 pr-4">
        <span className="inline-flex rounded-pill bg-primary/15 px-2 py-0.5 text-tiny font-semibold text-primary-dark capitalize">
          {item.chargeType === 'fnb' ? 'FnB' : item.chargeType}
        </span>
      </td>
      <td className="text-small text-primary-dark py-3 text-right whitespace-nowrap font-semibold">{formatMoney(item.amount, symbol)}</td>
    </tr>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-small text-secondary-light">{label}</span>
      <span className="text-small font-semibold text-secondary">{value}</span>
    </div>
  );
}
