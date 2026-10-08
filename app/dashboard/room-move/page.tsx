'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { RadioCard } from '@/components/ui/RadioCard';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { RoomUpgradeIcon } from '@/components/ui/Icons';
import { ApiError } from '@/lib/api';
import { useInHouseQuery, useMoveRoomMutation, useRoomMoveQuoteQuery } from '@/lib/reservations';
import { useRoomsQuery, type RoomWithDetails } from '@/lib/rooms';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { useAuthStore } from '@/lib/store/authStore';
import { RoomPicker } from '../_components/RoomPicker';
import { formatDateOnly } from '@/lib/dates';

type RateChoice = 'keep' | 'new';

/**
 * Room Move & Upgrade (ref: Room Upgrade — "Switch guest to a higher room
 * category": available upgrade rooms, rate difference, folio adjustment
 * preview). A guest already in the house changes rooms from tonight — the
 * AC failed, they asked for a suite. They keep the rate they booked, or the
 * nights left are charged at the new room type's rate under their own deal;
 * the backend's quote shows both before anything moves. Nights already on
 * the bill stay as billed. The old room goes to housekeeping dirty.
 */
export default function RoomMovePage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [search, setSearch] = useState('');
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomWithDetails | null>(null);
  const [rateChoice, setRateChoice] = useState<RateChoice | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const inHouseQuery = useInHouseQuery(activeBranchId, auth);
  const roomsQuery = useRoomsQuery(activeBranchId, auth);
  const quoteQuery = useRoomMoveQuoteQuery(reservationId, room?.roomType.id ?? null, auth);
  const moveMutation = useMoveRoomMutation(activeBranchId ?? '', auth);

  const guests = useMemo(() => inHouseQuery.data ?? [], [inHouseQuery.data]);
  const guestOptions: SelectOption[] = useMemo(() => {
    const q = search.trim().toLowerCase();
    return guests
      .filter((r) => !q || [r.guest.name, r.room?.number ?? '', r.confirmationNumber].some((v) => v.toLowerCase().includes(q)))
      .map((r) => ({ value: r.id, label: `${r.guest.name} — Room ${r.room?.number ?? '?'} · ${r.roomType.name} · ${r.confirmationNumber}` }));
  }, [guests, search]);
  const stay = guests.find((r) => r.id === reservationId) ?? null;
  const symbol = currencySymbolFor(stay?.branch.currency);
  const quote = quoteQuery.data;

  function pickGuest(id: string) {
    setReservationId(id);
    setRoom(null);
    setRateChoice(null);
    setNotice(null);
    setError(null);
  }

  function pickRoom(next: RoomWithDetails) {
    setRoom(next);
    setRateChoice(null);
  }

  const canMove = Boolean(stay && room && reason.trim() && (rateChoice !== null || (quote && quote.nightsLeft === 0)));

  async function handleMove() {
    if (!stay || !room || !canMove) return;
    setError(null);
    try {
      await moveMutation.mutateAsync({ reservationId: stay.id, roomId: room.id, reason: reason.trim(), chargeNewRate: rateChoice === 'new' });
      setNotice(`Moved ${stay.guest.name} from room ${stay.room?.number ?? '?'} to room ${room.number} (${room.roomType.name}). Room ${stay.room?.number ?? '?'} is on the Task Board for cleaning.`);
      setReservationId(null);
      setRoom(null);
      setRateChoice(null);
      setReason('');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not move the guest.');
    }
  }

  if (!activeBranchId) return null;

  const difference = quote ? Number(quote.newTotal) - Number(quote.keepTotal) : 0;
  const nightsWord = (n: number) => `${n} night${n === 1 ? '' : 's'}`;

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader
        icon={<RoomUpgradeIcon className="size-8" />}
        title="Room Move & Upgrade"
        subtitle="Move a guest in the house to another room — at their rate, or the new room's."
        roles="Front Desk · Manager"
      />

      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {notice ? (
        <Card tone="secondary">
          <p className="text-small text-surface">{notice}</p>
        </Card>
      ) : null}

      <Section label="Guest">
        <SearchInput label="Search guests in the house" placeholder="Guest, room or confirmation #" value={search} onChange={setSearch} />
        <Select id="room-move-guest" name="reservationId" label="Guest in the house" options={guestOptions} value={reservationId} onChange={pickGuest} />
        {stay ? (
          <Card tone="accent" className="flex flex-col gap-1">
            <Row label="Now in" value={`Room ${stay.room?.number ?? '?'} — ${stay.roomType.name}`} />
            <Row label="Leaving" value={formatDateOnly(stay.checkOutDate)} />
          </Card>
        ) : null}
      </Section>

      {stay ? (
        <Section label="New Room">
          <RoomPicker rooms={roomsQuery.data ?? []} excludeRoomId={stay.room?.id} selectedRoomId={room?.id ?? null} onSelect={pickRoom} />
        </Section>
      ) : null}

      {stay && room ? (
        <Section label="Rate">
          {quoteQuery.isLoading ? (
            <p className="text-body text-surface-muted">Working out the nights left…</p>
          ) : quoteQuery.isError || !quote ? (
            <p className="text-body text-red-600">Couldn&apos;t price the nights left for this room.</p>
          ) : quote.nightsLeft === 0 ? (
            <p className="text-body text-surface-muted">Every night of the stay is already on the bill — the move changes the room, not the price.</p>
          ) : (
            <>
              <RadioCard<RateChoice>
                name="rateChoice"
                value={rateChoice}
                onChange={setRateChoice}
                options={[
                  {
                    value: 'keep',
                    title: 'Keep their rate',
                    description: `${formatMoney(quote.currentNightly, symbol)} a night — ${formatMoney(quote.keepTotal, symbol)} for the ${nightsWord(quote.nightsLeft)} left${
                      room.roomType.id !== stay.roomType.id ? `, in the ${room.roomType.name}.` : '.'
                    }`,
                  },
                  {
                    value: 'new',
                    title: `Charge the ${room.roomType.name} rate`,
                    description: `${formatMoney(quote.newNightly, symbol)} a night — ${formatMoney(quote.newTotal, symbol)} for the ${nightsWord(quote.nightsLeft)} left (${
                      difference === 0 ? 'the same' : `${formatMoney(Math.abs(difference), symbol)} ${difference > 0 ? 'more' : 'less'}`
                    }).`,
                  },
                ]}
              />
              <p className="text-small text-surface-muted">
                From {quote.firstNight ? new Date(`${quote.firstNight}T00:00:00`).toLocaleDateString() : 'tonight'}.
                {quote.tonightAlreadyBilled ? ' Tonight is already on the bill from check-in, at the old rate — it stays as billed.' : ''} Tax applies to each night as usual.
              </p>
            </>
          )}
          <Input label="Reason" name="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} hint="Required — kept in the audit log" />
          <Button type="button" onClick={handleMove} disabled={!canMove} loading={moveMutation.isPending} className="self-start">
            Move Guest
          </Button>
        </Section>
      ) : null}
    </Container>
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
