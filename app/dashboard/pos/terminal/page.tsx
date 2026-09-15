'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { PosTerminalIcon } from '@/components/ui/Icons';
import { ApiError } from '@/lib/api';
import { currencySymbolFor } from '@/lib/currencies';
import { formatMoney } from '@/lib/numberFormat';
import {
  OUTLET_CATEGORY_LABELS,
  SETTLEMENT_LABELS,
  useCreateOrderMutation,
  useOutletMenuQuery,
  useOutletOrdersQuery,
  useOutletsQuery,
  usePosQuoteQuery,
  useRoomLookupQuery,
  useVoidOrderMutation,
  type BasketLine,
  type MenuItem,
  type ModifierGroup,
  type Outlet,
  type PosOrder,
  type PosSettlement,
} from '@/lib/pos';
import { isSupervisorAtBranch } from '@/lib/roles';
import { useAuthStore } from '@/lib/store/authStore';
import { printReceipt } from '../_components/printReceipt';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/** A basket line plus what the cashier sees on it. Prices are never kept here — they come from the server's quote. */
type BasketEntry = BasketLine & { key: string; name: string; choiceLabels: string[] };

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.message : fallback;
}

/** The same item with the same choices is one line with a bigger quantity. */
function basketKey(menuItemId: string, modifiers: BasketLine['modifiers']): string {
  return `${menuItemId}|${JSON.stringify(modifiers ?? [])}`;
}

function settledText(order: PosOrder): string {
  if (order.settlement === 'room' && order.reservation) {
    return `Room ${order.reservation.room?.number ?? '—'} · ${order.reservation.guest.name}`;
  }
  return order.settlement === 'cash' ? 'Paid in cash' : 'Paid by card';
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-tiny text-primary-dark/70">{label}</p>
      <p className="text-body font-semibold text-primary-dark">{value}</p>
    </div>
  );
}

export default function PosTerminalPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };
  const outletsQuery = useOutletsQuery(activeBranchId, auth);
  const [chosenOutletId, setChosenOutletId] = useState<string | null>(null);

  if (!activeBranchId) return null;

  const supervisor = isSupervisorAtBranch(user, activeBranchId);
  const outlets = (outletsQuery.data ?? []).filter((o) => o.isActive);
  // Someone assigned to a single outlet lands straight on it.
  const outletId =
    chosenOutletId && outlets.some((o) => o.id === chosenOutletId) ? chosenOutletId : outlets.length === 1 ? (outlets[0]?.id ?? null) : null;
  const outlet = outlets.find((o) => o.id === outletId) ?? null;

  return (
    <Container className="max-w-7xl py-10 flex flex-col gap-8">
      <PageHeader
        icon={<PosTerminalIcon className="size-8" />}
        title="POS Terminal"
        subtitle="Ring up orders at an outlet — charge them to a guest's room, or take cash or card."
        roles="F&B Staff · Spa · Laundry"
      />

      {outletsQuery.isError ? <p className="text-body text-red-600">{errorText(outletsQuery.error, "Couldn't load the outlets.")}</p> : null}
      {outletsQuery.isSuccess && outlets.length === 0 ? (
        <Card tone="accent">
          {supervisor ? (
            <p className="text-body text-primary-dark">
              No outlets are open yet.{' '}
              <Link href="/dashboard/pos/menu" className="font-semibold underline">
                Set one up in Menu Management
              </Link>
              .
            </p>
          ) : (
            <p className="text-body text-primary-dark">You aren&apos;t assigned to an outlet yet — ask a manager to add you in Menu Management.</p>
          )}
        </Card>
      ) : null}

      {outlets.length > 1 ? (
        <div className="max-w-sm">
          <Select
            name="outlet"
            label="Outlet"
            placeholder="Choose an outlet"
            options={outlets.map((o) => ({ value: o.id, label: `${o.name} · ${OUTLET_CATEGORY_LABELS[o.category]}` }))}
            value={outletId}
            onChange={setChosenOutletId}
          />
        </div>
      ) : null}

      {outlet ? (
        <>
          <OutletTerminal key={outlet.id} outlet={outlet} branchId={activeBranchId} auth={auth} />
          <TodaysOrders outletId={outlet.id} supervisor={supervisor} auth={auth} />
        </>
      ) : null}
    </Container>
  );
}

function OutletTerminal({ outlet, branchId, auth }: { outlet: Outlet; branchId: string; auth: AuthOpts }) {
  const menuQuery = useOutletMenuQuery(outlet.id, auth);
  const [basket, setBasket] = useState<BasketEntry[]>([]);
  const [chosenCategory, setChosenCategory] = useState<string | null>(null);
  const [pickingItem, setPickingItem] = useState<MenuItem | null>(null);
  const [lastOrder, setLastOrder] = useState<PosOrder | null>(null);

  const menu = menuQuery.data;
  const symbol = currencySymbolFor(menu?.currency);
  const items = menu?.items ?? [];
  const categories = [...new Set(items.map((item) => item.category))];
  const category = chosenCategory && categories.includes(chosenCategory) ? chosenCategory : (categories[0] ?? null);

  function add(item: MenuItem, modifiers: BasketLine['modifiers'], choiceLabels: string[]) {
    const key = basketKey(item.id, modifiers);
    setBasket((current) =>
      current.some((entry) => entry.key === key)
        ? current.map((entry) => (entry.key === key ? { ...entry, qty: Math.min(99, entry.qty + 1) } : entry))
        : [...current, { key, menuItemId: item.id, name: item.name, qty: 1, modifiers, choiceLabels }],
    );
    setLastOrder(null);
  }

  function pick(item: MenuItem) {
    if ((item.modifiers ?? []).length > 0) setPickingItem(item);
    else add(item, undefined, []);
  }

  function setQty(key: string, qty: number) {
    setBasket((current) =>
      qty <= 0 ? current.filter((entry) => entry.key !== key) : current.map((entry) => (entry.key === key ? { ...entry, qty: Math.min(99, qty) } : entry)),
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 items-start">
      <Section label={`${outlet.name} — Menu`} className="lg:col-span-3">
        {menuQuery.isLoading ? <p className="text-body text-primary-dark/70">Loading the menu…</p> : null}
        {menuQuery.isError ? <p className="text-body text-red-600">{errorText(menuQuery.error, "Couldn't load the menu.")}</p> : null}
        {menu && items.length === 0 ? <p className="text-body text-primary-dark/70">This outlet&apos;s menu is empty — add items in Menu Management.</p> : null}

        {categories.length > 0 ? (
          <div role="tablist" aria-label="Menu categories" className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                role="tab"
                aria-selected={c === category}
                onClick={() => setChosenCategory(c)}
                className={`rounded-pill px-3 py-1 text-small font-semibold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  c === category ? 'bg-secondary text-white' : 'bg-secondary/5 text-secondary hover:bg-secondary/10'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        ) : null}

        <div role="tabpanel" aria-label={category ?? 'Menu'} className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {items
            .filter((item) => item.category === category)
            .map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={!item.isAvailable}
                onClick={() => pick(item)}
                className="flex flex-col items-start gap-1 rounded-card border border-secondary/20 bg-secondary/5 p-3 text-left cursor-pointer transition-colors hover:bg-secondary/10 active:bg-secondary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-secondary/5"
              >
                <span className="text-body font-semibold text-secondary">{item.name}</span>
                <span className="text-small text-secondary-light">{formatMoney(item.price, symbol)}</span>
                {!item.isAvailable ? <span className="text-tiny font-semibold uppercase text-red-700">86&apos;d</span> : null}
                {item.isAvailable && (item.modifiers ?? []).length > 0 ? <span className="text-tiny text-secondary-light">Has choices</span> : null}
              </button>
            ))}
        </div>
      </Section>

      <Section label="Order" className="lg:col-span-2">
        <OrderPanel
          outlet={outlet}
          branchId={branchId}
          auth={auth}
          basket={basket}
          symbol={symbol}
          onQty={setQty}
          onClear={() => setBasket([])}
          onSold={(order) => {
            setBasket([]);
            setLastOrder(order);
          }}
        />
        {lastOrder ? (
          <Card tone="primary" className="flex flex-col gap-2">
            <p className="text-body font-semibold text-secondary">
              Order #{lastOrder.orderNo} — {formatMoney(lastOrder.total, symbol)}
            </p>
            <p className="text-small text-secondary-light">{settledText(lastOrder)}</p>
            <div>
              <Button type="button" size="sm" variant="outline" onClick={() => printReceipt(lastOrder)}>
                Print receipt
              </Button>
            </div>
          </Card>
        ) : null}
      </Section>

      {pickingItem ? (
        <ModifierPicker
          key={pickingItem.id}
          item={pickingItem}
          symbol={symbol}
          onClose={() => setPickingItem(null)}
          onAdd={(modifiers, labels) => {
            add(pickingItem, modifiers, labels);
            setPickingItem(null);
          }}
        />
      ) : null}
    </div>
  );
}

function OrderPanel({
  outlet,
  branchId,
  auth,
  basket,
  symbol,
  onQty,
  onClear,
  onSold,
}: {
  outlet: Outlet;
  branchId: string;
  auth: AuthOpts;
  basket: BasketEntry[];
  symbol: string;
  onQty: (key: string, qty: number) => void;
  onClear: () => void;
  onSold: (order: PosOrder) => void;
}) {
  const lines = useMemo<BasketLine[]>(() => basket.map(({ menuItemId, qty, modifiers }) => ({ menuItemId, qty, modifiers })), [basket]);
  const quoteQuery = usePosQuoteQuery(outlet.id, lines, auth);
  const createMutation = useCreateOrderMutation(auth);
  const [settlement, setSettlement] = useState<PosSettlement | null>(null);
  const [roomInput, setRoomInput] = useState('');
  const [lookupRoom, setLookupRoom] = useState<string | null>(null);
  const [tableNumber, setTableNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const lookup = useRoomLookupQuery(branchId, settlement === 'room' ? lookupRoom : null, auth);

  const quote = basket.length > 0 ? quoteQuery.data : undefined;
  const repricing = quoteQuery.isFetching;
  // The guest shown is the one for the room number as typed now — edit the number and the confirmation goes.
  const lookupCurrent = lookupRoom !== null && lookupRoom === roomInput.trim();
  const guest = settlement === 'room' && lookupCurrent ? lookup.data : undefined;
  const total = quote ? formatMoney(quote.total, symbol) : '';
  const ready =
    basket.length > 0 &&
    quote !== undefined &&
    !quoteQuery.isError &&
    !repricing &&
    settlement !== null &&
    (settlement !== 'room' || (guest !== undefined && !guest.billClosed));

  let submitLabel = 'Choose how it’s paid';
  if (settlement === 'room') submitLabel = guest ? `Charge ${total} to Room ${guest.roomNumber}` : 'Find the guest first';
  if (settlement === 'cash') submitLabel = `Take ${total} cash`;
  if (settlement === 'card') submitLabel = `Take ${total} by card`;

  async function submit() {
    if (!ready || settlement === null) return;
    setError(null);
    try {
      const order = await createMutation.mutateAsync({
        outletId: outlet.id,
        settlement,
        items: lines,
        reservationId: settlement === 'room' ? guest?.reservationId : undefined,
        tableNumber: tableNumber.trim() || undefined,
      });
      setSettlement(null);
      setRoomInput('');
      setLookupRoom(null);
      setTableNumber('');
      onSold(order);
    } catch (err) {
      setError(errorText(err, "Couldn't ring this order up."));
    }
  }

  return (
    <Card className="flex flex-col gap-4">
      {basket.length === 0 ? (
        <p className="text-body text-primary-dark/70">Tap an item to start an order.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-secondary/10">
          {basket.map((entry, index) => {
            const priced = quote?.lines[index];
            const current = priced && priced.menuItemId === entry.menuItemId && priced.qty === entry.qty ? priced : undefined;
            return (
              <li key={entry.key} className="flex items-start justify-between gap-3 py-2">
                <div className="min-w-0">
                  <p className="text-body font-semibold text-secondary">{entry.name}</p>
                  {entry.choiceLabels.length > 0 ? <p className="text-tiny text-secondary-light">{entry.choiceLabels.join(', ')}</p> : null}
                  <div className="mt-1 flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" aria-label={`One less ${entry.name}`} onClick={() => onQty(entry.key, entry.qty - 1)}>
                      −
                    </Button>
                    <span className="w-6 text-center text-small font-semibold text-secondary" aria-label={`${entry.name} quantity`}>
                      {entry.qty}
                    </span>
                    <Button type="button" size="sm" variant="outline" aria-label={`One more ${entry.name}`} onClick={() => onQty(entry.key, entry.qty + 1)}>
                      +
                    </Button>
                  </div>
                </div>
                <span className="text-body text-secondary whitespace-nowrap">{current ? formatMoney(current.lineTotal, symbol) : '…'}</span>
              </li>
            );
          })}
        </ul>
      )}

      <dl className={`flex flex-col gap-1 border-t border-secondary/20 pt-3 ${repricing ? 'opacity-50' : ''}`} aria-busy={repricing}>
        <div className="flex justify-between text-small text-secondary">
          <dt>Subtotal</dt>
          <dd>{quote ? formatMoney(quote.subtotal, symbol) : '—'}</dd>
        </div>
        <div className="flex justify-between text-small text-secondary">
          <dt>Tax</dt>
          <dd>{quote ? formatMoney(quote.taxTotal, symbol) : '—'}</dd>
        </div>
        <div className="flex justify-between text-header font-bold text-secondary">
          <dt>Total</dt>
          <dd>{quote ? total : '—'}</dd>
        </div>
      </dl>
      {basket.length > 0 && quoteQuery.isError ? <p className="text-small text-red-600">{errorText(quoteQuery.error, "Couldn't price this order.")}</p> : null}

      {outlet.category === 'restaurant' || outlet.category === 'bar' ? (
        <Input name="tableNumber" label="Table (optional)" value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} placeholder="T4" maxLength={20} />
      ) : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="text-small font-semibold text-secondary">Paid by</legend>
        <div className="flex flex-wrap gap-2">
          {(['room', 'cash', 'card'] as const).map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={settlement === option ? 'secondary' : 'outline'}
              aria-pressed={settlement === option}
              onClick={() => {
                setSettlement(option);
                setError(null);
              }}
            >
              {option === 'room' ? 'Charge to room' : SETTLEMENT_LABELS[option]}
            </Button>
          ))}
        </div>
      </fieldset>

      {settlement === 'room' ? (
        <div className="flex flex-col gap-2">
          <form
            className="flex items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setLookupRoom(roomInput.trim() || null);
            }}
          >
            <div className="flex-1">
              <Input name="roomNumber" label="Room number" value={roomInput} onChange={(e) => setRoomInput(e.target.value)} placeholder="204" autoComplete="off" maxLength={20} />
            </div>
            <Button type="submit" size="sm" variant="outline" loading={lookup.isFetching} disabled={!roomInput.trim()}>
              Find guest
            </Button>
          </form>
          {guest ? (
            <Card tone={guest.billClosed ? 'accent' : 'primary'}>
              <p className="text-body font-semibold text-secondary">{guest.guestName}</p>
              <p className="text-small text-secondary-light">
                Room {guest.roomNumber} · leaving {new Date(guest.checkOutDate).toLocaleDateString(undefined, { timeZone: 'UTC' })}
              </p>
              {guest.billClosed ? (
                <p className="text-small text-red-600">This guest&apos;s bill is settled and closed — the front desk has to reopen it first. Take cash or card instead.</p>
              ) : (
                <p className="text-tiny text-secondary-light">Check the name with the guest before charging.</p>
              )}
            </Card>
          ) : null}
          {settlement === 'room' && lookupCurrent && lookup.isError ? (
            <p className="text-small text-red-600">{errorText(lookup.error, "Couldn't look that room up.")}</p>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="flex flex-col gap-2">
        <Button type="button" onClick={submit} disabled={!ready} loading={createMutation.isPending}>
          {submitLabel}
        </Button>
        {basket.length > 0 ? (
          <Button type="button" size="sm" variant="outline" onClick={onClear} disabled={createMutation.isPending}>
            Clear order
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

/** Picks an item's choices. Shows each option's own price adjustment as the menu states it — the order's total still comes from the server. */
function ModifierPicker({
  item,
  symbol,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  symbol: string;
  onClose: () => void;
  onAdd: (modifiers: BasketLine['modifiers'], labels: string[]) => void;
}) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const groups = item.modifiers ?? [];
  const missing = groups.filter((group) => group.required && (picked[group.name] ?? []).length === 0);

  function toggle(group: ModifierGroup, label: string) {
    setPicked((current) => {
      const chosen = current[group.name] ?? [];
      if (group.selection === 'single') return { ...current, [group.name]: [label] };
      return { ...current, [group.name]: chosen.includes(label) ? chosen.filter((l) => l !== label) : [...chosen, label] };
    });
  }

  function confirm() {
    const modifiers = groups
      .filter((group) => (picked[group.name] ?? []).length > 0)
      .map((group) => ({ group: group.name, options: picked[group.name] ?? [] }));
    onAdd(modifiers.length > 0 ? modifiers : undefined, modifiers.flatMap((m) => m.options));
  }

  return (
    <Modal open onClose={onClose} title={item.name}>
      <div className="flex flex-col gap-4 max-h-[60vh] overflow-y-auto">
        {groups.map((group) => (
          <fieldset key={group.name} className="flex flex-col gap-2">
            <legend className="text-small font-semibold text-secondary">
              {group.name}{' '}
              <span className="font-normal text-secondary-light">
                {group.selection === 'single' ? 'Choose one' : 'Choose any'}
                {group.required ? ' · required' : ''}
              </span>
            </legend>
            {group.options.map((option) => (
              <label
                key={option.label}
                className="flex items-center justify-between gap-3 rounded-control border border-secondary/20 px-3 py-2 cursor-pointer hover:bg-secondary/5"
              >
                <span className="flex items-center gap-2 text-body text-secondary">
                  <input
                    type={group.selection === 'single' ? 'radio' : 'checkbox'}
                    name={`${item.id}-${group.name}`}
                    checked={(picked[group.name] ?? []).includes(option.label)}
                    onChange={() => toggle(group, option.label)}
                    className="size-4 accent-secondary"
                  />
                  {option.label}
                </span>
                {option.price > 0 ? <span className="text-small text-secondary-light">+{formatMoney(option.price, symbol)}</span> : null}
              </label>
            ))}
          </fieldset>
        ))}
      </div>
      <Button type="button" onClick={confirm} disabled={missing.length > 0}>
        {missing.length > 0 ? `Choose a ${missing[0]?.name.toLowerCase()}` : 'Add to order'}
      </Button>
    </Modal>
  );
}

function TodaysOrders({ outletId, supervisor, auth }: { outletId: string; supervisor: boolean; auth: AuthOpts }) {
  const ordersQuery = useOutletOrdersQuery(outletId, auth);
  const [voiding, setVoiding] = useState<PosOrder | null>(null);
  const day = ordersQuery.data;
  const symbol = currencySymbolFor(day?.currency);

  return (
    <Section label="Today's Orders">
      {ordersQuery.isError ? <p className="text-body text-red-600">{errorText(ordersQuery.error, "Couldn't load today's orders.")}</p> : null}
      {day ? (
        <Card tone="accent" className="flex flex-wrap gap-x-8 gap-y-2">
          <Stat label="Orders" value={String(day.summary.orderCount)} />
          <Stat label="Takings" value={formatMoney(day.summary.total, symbol)} />
          <Stat label="Charged to rooms" value={formatMoney(day.summary.room, symbol)} />
          <Stat label="Cash" value={formatMoney(day.summary.cash, symbol)} />
          <Stat label="Card" value={formatMoney(day.summary.card, symbol)} />
          {day.summary.voidCount > 0 ? <Stat label="Voided" value={String(day.summary.voidCount)} /> : null}
        </Card>
      ) : null}
      {day && day.orders.length === 0 ? <p className="text-body text-primary-dark/70">No orders yet today.</p> : null}
      <ul className="flex flex-col gap-2">
        {(day?.orders ?? []).map((order) => (
          <li key={order.id}>
            <Card className={`flex flex-wrap items-center justify-between gap-3 ${order.voidedAt ? 'opacity-60' : ''}`}>
              <div className="min-w-0">
                <p className="text-body font-semibold text-secondary">
                  #{order.orderNo} · {formatMoney(order.total, symbol)}
                  {order.voidedAt ? <span className="ml-2 rounded-pill bg-red-100 px-2 py-0.5 text-tiny font-semibold text-red-800">Void</span> : null}
                </p>
                <p className="text-small text-secondary-light">
                  {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · {order.items.map((l) => `${l.qty}× ${l.name}`).join(', ')} ·{' '}
                  {settledText(order)}
                  {order.tableNumber ? ` · Table ${order.tableNumber}` : ''}
                  {order.cashierName ? ` · ${order.cashierName}` : ''}
                </p>
                {order.voidReason ? <p className="text-tiny text-secondary-light">Voided: {order.voidReason}</p> : null}
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => printReceipt(order)}>
                  Receipt
                </Button>
                {supervisor && !order.voidedAt ? (
                  <Button type="button" size="sm" variant="outline" onClick={() => setVoiding(order)}>
                    Void
                  </Button>
                ) : null}
              </div>
            </Card>
          </li>
        ))}
      </ul>
      {voiding ? <VoidOrderDialog key={voiding.id} order={voiding} outletId={outletId} auth={auth} symbol={symbol} onClose={() => setVoiding(null)} /> : null}
    </Section>
  );
}

function VoidOrderDialog({ order, outletId, auth, symbol, onClose }: { order: PosOrder; outletId: string; auth: AuthOpts; symbol: string; onClose: () => void }) {
  const mutation = useVoidOrderMutation(outletId, auth);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const amount = formatMoney(order.total, symbol);
  const consequence =
    order.settlement === 'room'
      ? `${amount} comes off ${order.reservation?.guest.name ?? 'the guest'}'s bill, tax and all.`
      : order.settlement === 'cash'
        ? `${amount} comes out of this shift's expected cash — hand the money back.`
        : `Refund ${amount} on the card machine as well.`;

  async function confirm() {
    setError(null);
    try {
      await mutation.mutateAsync({ orderId: order.id, reason: reason.trim() });
      onClose();
    } catch (err) {
      setError(errorText(err, "Couldn't void this order."));
    }
  }

  return (
    <Modal open onClose={onClose} title={`Void order #${order.orderNo}`}>
      <p className="text-body text-secondary">{consequence}</p>
      <Textarea name="voidReason" label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Rung up on the wrong table" maxLength={500} />
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Keep it
        </Button>
        <Button type="button" variant="danger" onClick={confirm} loading={mutation.isPending} disabled={reason.trim().length < 3}>
          Void order
        </Button>
      </div>
    </Modal>
  );
}
