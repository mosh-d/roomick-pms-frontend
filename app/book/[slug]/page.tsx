'use client';

import { useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api';
import {
  usePublicPropertyQuery,
  usePublicRoomTypesQuery,
  usePublicAvailabilityQuery,
  usePublicQuoteQuery,
  usePublicBookingMutation,
  type PublicBookingConfirmation,
  type PublicProperty,
  type PublicRoomType,
} from '@/lib/publicBooking';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(`${iso}T00:00:00.000Z`) + days * 86_400_000).toISOString().slice(0, 10);
}

function formatAddress(address: PublicProperty['address']): string {
  if (!address) return '';
  return [address.street, address.city, address.state, address.country].filter(Boolean).join(', ');
}

/**
 * The Direct Booking Engine's guest-facing page (Month 7) — a hotel's own
 * zero-commission booking surface, reached at `/book/<the property's slug>`.
 *
 * Deliberately OUTSIDE `/dashboard`: it renders for anyone with the link, has
 * no sidebar/breadcrumb shell, reads no auth store, and every request it
 * makes is genuinely anonymous (see lib/publicBooking.ts). It is the only
 * page in this app a guest — rather than a staff member — is meant to see.
 *
 * Every price shown here comes from the backend's own Rate Resolver quote.
 * Nothing on this page multiplies a nightly rate by a night count to display
 * a total: a direct booking and a front-desk booking resolve through the
 * identical cascade, so rate parity is structural rather than a promise.
 */
export default function PublicBookingPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const propertyQuery = usePublicPropertyQuery(slug);
  const [confirmation, setConfirmation] = useState<PublicBookingConfirmation | null>(null);

  if (propertyQuery.isLoading) {
    return (
      <Container className="max-w-4xl py-16">
        <p className="text-body text-secondary-light">Loading…</p>
      </Container>
    );
  }

  if (propertyQuery.isError || !propertyQuery.data) {
    return (
      <Container className="max-w-4xl py-16 flex flex-col gap-3">
        <h1 className="font-display text-h2 text-secondary">Property not found</h1>
        <p className="text-body text-secondary-light">
          This booking link isn&rsquo;t active. It may have been taken down, or the address may be mistyped — please check the link with the property directly.
        </p>
      </Container>
    );
  }

  const property = propertyQuery.data;

  return (
    <Container className="max-w-4xl py-10 flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-small font-semibold uppercase tracking-wide text-accent-dark">{property.brandName}</p>
        <h1 className="font-display text-h1 text-secondary">{property.name}</h1>
        {formatAddress(property.address) ? <p className="text-body text-secondary-light">{formatAddress(property.address)}</p> : null}
        <p className="text-small text-secondary-light">
          Check-in from {property.checkInTime} · Check-out by {property.checkOutTime}
        </p>
      </header>

      {confirmation ? (
        <BookingConfirmed confirmation={confirmation} property={property} onBookAnother={() => setConfirmation(null)} />
      ) : (
        <BookingFlow slug={slug} property={property} onBooked={setConfirmation} />
      )}
    </Container>
  );
}

function BookingConfirmed({
  confirmation,
  property,
  onBookAnother,
}: {
  confirmation: PublicBookingConfirmation;
  property: PublicProperty;
  onBookAnother: () => void;
}) {
  return (
    <Section label="Booking Confirmed">
      <Card tone="accent" className="flex flex-col gap-3">
        <p className="text-body text-primary-dark">
          Thank you, {confirmation.guestName} — your stay at {property.name} is confirmed.
        </p>
        <p className="font-display text-h2 text-secondary">{confirmation.confirmationNumber}</p>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-small text-secondary">
          <div>
            <dt className="text-secondary-light">Room</dt>
            <dd className="font-semibold">{confirmation.roomTypeName}</dd>
          </div>
          <div>
            <dt className="text-secondary-light">Total</dt>
            <dd className="font-semibold">
              {confirmation.currency} {confirmation.totalRate}
            </dd>
          </div>
          <div>
            <dt className="text-secondary-light">Check-in</dt>
            <dd className="font-semibold">
              {new Date(confirmation.checkInDate).toLocaleDateString()} from {property.checkInTime}
            </dd>
          </div>
          <div>
            <dt className="text-secondary-light">Check-out</dt>
            <dd className="font-semibold">
              {new Date(confirmation.checkOutDate).toLocaleDateString()} by {property.checkOutTime}
            </dd>
          </div>
        </dl>
        <p className="text-small text-primary-dark/70">
          Payment is taken at the property on arrival. Please quote your confirmation number when you check in.
        </p>
      </Card>
      <div>
        <Button type="button" variant="outline" onClick={onBookAnother}>
          Book another stay
        </Button>
      </div>
    </Section>
  );
}

function BookingFlow({
  slug,
  property,
  onBooked,
}: {
  slug: string;
  property: PublicProperty;
  onBooked: (confirmation: PublicBookingConfirmation) => void;
}) {
  const [checkInDate, setCheckInDate] = useState(() => addDays(todayIso(), 1));
  const [checkOutDate, setCheckOutDate] = useState(() => addDays(todayIso(), 3));
  const [adults, setAdults] = useState('2');
  const [children, setChildren] = useState('0');
  const [selectedRoomTypeId, setSelectedRoomTypeId] = useState<string | null>(null);
  const [promoCode, setPromoCode] = useState('');

  const datesValid = Boolean(checkInDate && checkOutDate && checkOutDate > checkInDate);

  const roomTypesQuery = usePublicRoomTypesQuery(slug, true);
  const availabilityQuery = usePublicAvailabilityQuery(slug, checkInDate, checkOutDate, datesValid);

  // The fewest rooms free on ANY night of the stay is what's actually
  // bookable for the whole stay — a room type free on 2 of 3 nights can't
  // take this booking, so the minimum is the honest number to show.
  const availabilityByRoomType = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of availabilityQuery.data ?? []) {
      const min = row.nights.length > 0 ? Math.min(...row.nights.map((n) => n.available)) : 0;
      map.set(row.roomTypeId, min);
    }
    return map;
  }, [availabilityQuery.data]);

  const partySize = Number(adults) + Number(children || '0');

  return (
    <div className="flex flex-col gap-8">
      <Section label="Your Stay">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2">
          <Input
            id="booking-check-in"
            label="Check-in"
            type="date"
            min={todayIso()}
            value={checkInDate}
            onChange={(e) => {
              setCheckInDate(e.target.value);
              if (checkOutDate <= e.target.value) setCheckOutDate(addDays(e.target.value, 1));
              setSelectedRoomTypeId(null);
            }}
          />
          <Input
            id="booking-check-out"
            label="Check-out"
            type="date"
            min={addDays(checkInDate || todayIso(), 1)}
            value={checkOutDate}
            onChange={(e) => {
              setCheckOutDate(e.target.value);
              setSelectedRoomTypeId(null);
            }}
          />
          <Input id="booking-adults" label="Adults" type="number" min={1} max={20} value={adults} onChange={(e) => setAdults(e.target.value)} />
          <Input id="booking-children" label="Children" type="number" min={0} max={20} value={children} onChange={(e) => setChildren(e.target.value)} />
        </div>
        {!datesValid ? <p className="text-small text-red-600">Check-out must be after check-in.</p> : null}
      </Section>

      <Section label="Choose a Room">
        {roomTypesQuery.isLoading ? (
          <p className="text-body text-secondary-light">Loading rooms…</p>
        ) : (roomTypesQuery.data ?? []).length === 0 ? (
          <p className="text-body text-secondary-light">This property has no rooms listed for online booking yet.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {(roomTypesQuery.data ?? []).map((roomType) => (
              <RoomTypeCard
                key={roomType.id}
                roomType={roomType}
                currency={property.currency}
                available={availabilityQuery.isLoading ? null : (availabilityByRoomType.get(roomType.id) ?? 0)}
                partySize={partySize}
                selected={selectedRoomTypeId === roomType.id}
                onSelect={() => setSelectedRoomTypeId(roomType.id)}
                datesValid={datesValid}
              />
            ))}
          </div>
        )}
      </Section>

      {selectedRoomTypeId && datesValid ? (
        <GuestDetailsSection
          slug={slug}
          roomTypeId={selectedRoomTypeId}
          checkInDate={checkInDate}
          checkOutDate={checkOutDate}
          adults={Number(adults)}
          childGuests={Number(children || '0')}
          promoCode={promoCode}
          onPromoCodeChange={setPromoCode}
          onBooked={onBooked}
        />
      ) : null}
    </div>
  );
}

function RoomTypeCard({
  roomType,
  currency,
  available,
  partySize,
  selected,
  onSelect,
  datesValid,
}: {
  roomType: PublicRoomType;
  currency: string;
  available: number | null;
  partySize: number;
  selected: boolean;
  onSelect: () => void;
  datesValid: boolean;
}) {
  const capacity = roomType.maxAdults + roomType.maxChildren;
  const tooSmall = partySize > capacity;
  const soldOut = available !== null && available <= 0;
  const bookable = datesValid && !tooSmall && !soldOut;

  return (
    <Card tone={selected ? 'accent' : 'secondary'} className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-1 min-w-48">
        <p className="text-body font-bold text-secondary">{roomType.name}</p>
        <p className="text-small text-secondary-light">
          {[roomType.bedType, roomType.sizeM2 ? `${roomType.sizeM2} m²` : null, `Sleeps ${capacity}`].filter(Boolean).join(' · ')}
        </p>
        {roomType.amenities.length > 0 ? <p className="text-tiny text-secondary-light">{roomType.amenities.join(' · ')}</p> : null}
      </div>
      <div className="flex flex-col items-end gap-2">
        <p className="text-small text-secondary-light">
          from{' '}
          <span className="text-body font-bold text-secondary">
            {currency} {roomType.baseRate}
          </span>{' '}
          / night
        </p>
        {available === null ? (
          <p className="text-tiny text-secondary-light">Checking availability…</p>
        ) : soldOut ? (
          <p className="text-tiny text-red-600">Not available for these dates</p>
        ) : (
          <p className="text-tiny text-secondary-light">
            {available} room{available === 1 ? '' : 's'} left
          </p>
        )}
        {tooSmall ? <p className="text-tiny text-red-600">Too small for {partySize} guests</p> : null}
        <Button type="button" size="sm" variant={selected ? 'primary' : 'outline'} disabled={!bookable} onClick={onSelect}>
          {selected ? 'Selected' : 'Select'}
        </Button>
      </div>
    </Card>
  );
}

function GuestDetailsSection({
  slug,
  roomTypeId,
  checkInDate,
  checkOutDate,
  adults,
  // Not `children`: that's React's own reserved prop name for nested JSX,
  // and passing a number under it is a real error, not a style nit.
  childGuests,
  promoCode,
  onPromoCodeChange,
  onBooked,
}: {
  slug: string;
  roomTypeId: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  childGuests: number;
  promoCode: string;
  onPromoCodeChange: (value: string) => void;
  onBooked: (confirmation: PublicBookingConfirmation) => void;
}) {
  const [appliedPromo, setAppliedPromo] = useState('');
  const quoteQuery = usePublicQuoteQuery(slug, roomTypeId, checkInDate, checkOutDate, appliedPromo, true);
  const bookingMutation = usePublicBookingMutation(slug);

  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canSubmit = guestName.trim().length > 0 && guestEmail.trim().length > 0;

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    try {
      const confirmation = await bookingMutation.mutateAsync({
        roomTypeId,
        checkInDate,
        checkOutDate,
        adults,
        children: childGuests || undefined,
        guestName: guestName.trim(),
        guestEmail: guestEmail.trim(),
        guestPhone: guestPhone.trim() || undefined,
        specialRequests: specialRequests.trim() || undefined,
        promoCode: appliedPromo.trim() || undefined,
      });
      onBooked(confirmation);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Section label="Your Details">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        <Input id="guest-name" label="Full Name" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
        <Input id="guest-email" label="Email" type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} hint="Your confirmation is sent here." />
        <Input id="guest-phone" label="Phone (optional)" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} />
        <Input id="guest-requests" label="Special Requests (optional)" value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} />
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="w-48">
          <Input id="promo-code" label="Promo Code (optional)" value={promoCode} onChange={(e) => onPromoCodeChange(e.target.value)} />
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => setAppliedPromo(promoCode)} disabled={!promoCode.trim() || promoCode === appliedPromo}>
          Apply
        </Button>
        {appliedPromo ? <p className="text-small text-secondary-light">Applied: {appliedPromo}</p> : null}
      </div>

      {/* Every figure here is the backend's own resolved quote — this page
          never multiplies a nightly rate by a night count itself. */}
      <Card tone="accent" className="flex flex-col gap-2 max-w-md">
        <p className="text-small font-semibold text-primary-dark">Price</p>
        {quoteQuery.isLoading ? (
          <p className="text-small text-primary-dark/70">Calculating…</p>
        ) : quoteQuery.isError || !quoteQuery.data ? (
          <p className="text-small text-red-600">We couldn&rsquo;t price these dates. Please try different dates.</p>
        ) : (
          <dl className="flex flex-col gap-1 text-small text-secondary">
            <div className="flex justify-between">
              <dt>
                {quoteQuery.data.currency} {quoteQuery.data.nightlyRate} × {quoteQuery.data.nights} night{quoteQuery.data.nights === 1 ? '' : 's'}
              </dt>
              <dd>
                {quoteQuery.data.currency} {quoteQuery.data.subtotal}
              </dd>
            </div>
            {Number(quoteQuery.data.taxTotal) > 0 ? (
              <div className="flex justify-between">
                <dt>Taxes</dt>
                <dd>
                  {quoteQuery.data.currency} {quoteQuery.data.taxTotal}
                </dd>
              </div>
            ) : null}
            <div className="flex justify-between border-t border-secondary/20 pt-1 text-body font-bold">
              <dt>Total</dt>
              <dd>
                {quoteQuery.data.currency} {quoteQuery.data.totalWithTax}
              </dd>
            </div>
          </dl>
        )}
        <p className="text-tiny text-primary-dark/70">Payment is taken at the property on arrival.</p>
      </Card>

      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div>
        <Button type="button" onClick={submit} loading={bookingMutation.isPending} disabled={!canSubmit}>
          Confirm Booking
        </Button>
      </div>
    </Section>
  );
}
