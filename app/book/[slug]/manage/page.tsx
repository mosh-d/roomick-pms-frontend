'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { ApiError } from '@/lib/api';
import { useBookingLookupMutation, usePreArrivalMutation, usePublicPropertyQuery, type PublicBookingDetail } from '@/lib/publicBooking';

/** Guest-facing wording for `ReservationStatus`. The raw enum values are staff vocabulary and shouldn't leak onto this page. */
const STATUS_LABELS: Record<string, string> = {
  confirmed: 'Confirmed',
  checked_in: 'Checked in',
  checked_out: 'Checked out',
  cancelled: 'Cancelled',
  no_show: 'Recorded as a no-show',
  waitlisted: 'On the waitlist',
  walked: 'Moved to another property',
};

/**
 * "Manage my booking" (growth plan Month 9, Guest Self-Service Portal — first
 * slice). A guest who booked online has a confirmation number and, until now,
 * no way to look anything up again.
 *
 * Authentication is confirmation number + the email on the booking. That is a
 * deliberate, documented trade-off rather than the ideal: confirmation numbers
 * are sequential, so the email is what actually protects the record, and the
 * endpoint is throttled hard behind it. A magic link is better and is what the
 * plan calls for — it needs working outbound email, which this app doesn't
 * have yet.
 *
 * This slice is read-only. Changing or cancelling a stay has real policy
 * consequences (penalties, rate re-resolution) and belongs in its own pass
 * rather than being bolted on here.
 */
export default function ManageBookingPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const propertyQuery = usePublicPropertyQuery(slug);
  const lookupMutation = useBookingLookupMutation(slug);

  const [confirmationNumber, setConfirmationNumber] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [booking, setBooking] = useState<PublicBookingDetail | null>(null);

  const canSubmit = confirmationNumber.trim().length > 0 && email.trim().length > 0;

  async function submit() {
    if (!canSubmit) return;
    setError(null);
    try {
      setBooking(await lookupMutation.mutateAsync({ confirmationNumber: confirmationNumber.trim(), email: email.trim() }));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  if (propertyQuery.isError) {
    return (
      <Container className="max-w-3xl py-16 flex flex-col gap-3">
        <h1 className="font-display text-h2 text-secondary">Property not found</h1>
        <p className="text-body text-secondary-light">This booking link isn&rsquo;t active. Please check the link with the property directly.</p>
      </Container>
    );
  }

  return (
    <Container className="max-w-3xl py-10 flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        {propertyQuery.data ? <p className="text-small font-semibold uppercase tracking-wide text-accent-dark">{propertyQuery.data.brandName}</p> : null}
        <h1 className="font-display text-h1 text-secondary">{propertyQuery.data?.name ?? 'Your booking'}</h1>
        <p className="text-body text-secondary-light">Look up a booking you&rsquo;ve already made.</p>
      </header>

      {booking ? (
        <>
          <BookingDetail booking={booking} onLookupAnother={() => setBooking(null)} />
          {booking.status === 'confirmed' ? (
            <PreArrivalSection
              key={booking.confirmationNumber}
              slug={slug}
              booking={booking}
              lookupEmail={email.trim()}
              onCompleted={setBooking}
            />
          ) : null}
        </>
      ) : (
        <Section label="Find Your Booking">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 max-w-xl">
            <Input
              id="lookup-confirmation"
              label="Confirmation Number"
              value={confirmationNumber}
              onChange={(e) => {
                setConfirmationNumber(e.target.value);
                setError(null);
              }}
              placeholder="RES-2026-00001"
            />
            <Input
              id="lookup-email"
              label="Email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              hint="The address you used when booking."
            />
          </div>
          {error ? <p className="text-small text-red-600">{error}</p> : null}
          <div>
            <Button type="button" onClick={submit} loading={lookupMutation.isPending} disabled={!canSubmit}>
              Find Booking
            </Button>
          </div>
          <p className="text-tiny text-secondary-light">
            Can&rsquo;t find your confirmation number? Contact the property directly — for your security we can&rsquo;t look a booking up by email alone.
          </p>
        </Section>
      )}

      <p className="text-small text-secondary-light">
        <Link href={`/book/${slug}`} className="underline">
          Book another stay at {propertyQuery.data?.name ?? 'this property'}
        </Link>
      </p>
    </Container>
  );
}

/**
 * Pre-arrival check-in — the guest completing their own details before they
 * travel, so the desk only has to confirm and hand over a key.
 *
 * Only offered on a `confirmed` booking. A stay that's already started,
 * ended or been cancelled has nothing to prepare for, and the backend
 * refuses it anyway — this just avoids showing a form that can only fail.
 *
 * ID documents are deliberately not collected here. The property may still
 * need to see one on arrival; that's said plainly rather than implying
 * check-in is entirely done.
 */
function PreArrivalSection({
  slug,
  booking,
  lookupEmail,
  onCompleted,
}: {
  slug: string;
  booking: PublicBookingDetail;
  lookupEmail: string;
  onCompleted: (booking: PublicBookingDetail) => void;
}) {
  const preArrivalMutation = usePreArrivalMutation(slug);
  const [phone, setPhone] = useState(booking.guestPhone ?? '');
  const [nationality, setNationality] = useState(booking.guestNationality ?? '');
  const [arrivalTime, setArrivalTime] = useState(booking.estimatedArrivalTime ?? '');
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const alreadyDone = Boolean(booking.preArrivalCompletedAt);

  async function submit() {
    if (!accepted) return;
    setError(null);
    try {
      onCompleted(
        await preArrivalMutation.mutateAsync({
          confirmationNumber: booking.confirmationNumber,
          email: lookupEmail || booking.guestEmail || '',
          phone: phone.trim() || undefined,
          nationality: nationality.trim() || undefined,
          estimatedArrivalTime: arrivalTime || undefined,
          acceptHouseRules: true,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  if (alreadyDone) {
    return (
      <Section label="Check-In Details">
        <Card tone="secondary" className="flex flex-col gap-2">
          <p className="text-small font-semibold text-green-800">Check-in details completed</p>
          <p className="text-small text-secondary">
            Thanks — we have everything we need. {booking.estimatedArrivalTime ? `We'll expect you around ${booking.estimatedArrivalTime}.` : ''} Please bring
            photo ID for the front desk.
          </p>
        </Card>
      </Section>
    );
  }

  return (
    <Section label="Check In Online">
      <Card tone="secondary" className="flex flex-col gap-3">
        <p className="text-small text-secondary">Complete these now and check-in at the property will just be collecting your key.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-6 gap-y-2">
          <Input id="pre-arrival-phone" label="Phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234…" />
          <Input
            id="pre-arrival-nationality"
            label="Nationality"
            value={nationality}
            onChange={(e) => setNationality(e.target.value.toUpperCase().slice(0, 2))}
            placeholder="NG"
            hint="Two-letter country code."
          />
          <Input id="pre-arrival-arrival-time" label="Expected arrival" type="time" value={arrivalTime} onChange={(e) => setArrivalTime(e.target.value)} />
        </div>

        {booking.houseRules ? (
          <div className="flex flex-col gap-1">
            <p className="text-small font-semibold text-secondary">House rules</p>
            <div className="max-h-40 overflow-y-auto rounded-control border border-secondary/20 p-3 text-small text-secondary whitespace-pre-wrap">
              {booking.houseRules}
            </div>
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-small text-secondary">
          <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
          I accept {booking.houseRules ? 'the house rules above' : "the property's house rules"}
        </label>

        {error ? <p className="text-small text-red-600">{error}</p> : null}

        <div>
          <Button type="button" onClick={submit} loading={preArrivalMutation.isPending} disabled={!accepted}>
            Complete Check-In
          </Button>
        </div>

        <p className="text-tiny text-secondary-light">
          You&rsquo;ll still need to show photo ID when you arrive — identity documents can&rsquo;t be submitted online yet.
        </p>
      </Card>
    </Section>
  );
}

function BookingDetail({ booking, onLookupAnother }: { booking: PublicBookingDetail; onLookupAnother: () => void }) {
  const nights = Math.round((Date.parse(booking.checkOutDate) - Date.parse(booking.checkInDate)) / 86_400_000);
  const isCancelled = booking.status === 'cancelled' || booking.status === 'no_show';

  return (
    <Section label="Your Booking">
      <Card tone={isCancelled ? 'secondary' : 'accent'} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-h2 text-secondary">{booking.confirmationNumber}</p>
          <span className={`text-small font-semibold ${isCancelled ? 'text-red-600' : 'text-green-800'}`}>
            {STATUS_LABELS[booking.status] ?? booking.status}
          </span>
        </div>

        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-small text-secondary">
          <div>
            <dt className="text-secondary-light">Guest</dt>
            <dd className="font-semibold">{booking.guestName}</dd>
          </div>
          <div>
            <dt className="text-secondary-light">Room</dt>
            <dd className="font-semibold">{booking.roomTypeName}</dd>
          </div>
          <div>
            <dt className="text-secondary-light">Check-in</dt>
            <dd className="font-semibold">
              {new Date(booking.checkInDate).toLocaleDateString()} from {booking.property.checkInTime}
            </dd>
          </div>
          <div>
            <dt className="text-secondary-light">Check-out</dt>
            <dd className="font-semibold">
              {new Date(booking.checkOutDate).toLocaleDateString()} by {booking.property.checkOutTime}
            </dd>
          </div>
          <div>
            <dt className="text-secondary-light">Guests</dt>
            <dd className="font-semibold">
              {booking.adults} adult{booking.adults === 1 ? '' : 's'}
              {booking.children > 0 ? `, ${booking.children} child${booking.children === 1 ? '' : 'ren'}` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-secondary-light">
              Total · {nights} night{nights === 1 ? '' : 's'}
            </dt>
            <dd className="font-semibold">
              {booking.currency} {booking.totalRate}
            </dd>
          </div>
        </dl>

        {booking.specialRequests ? (
          <div className="text-small text-secondary">
            <p className="text-secondary-light">Your requests</p>
            <p>{booking.specialRequests}</p>
          </div>
        ) : null}

        {!isCancelled ? <p className="text-tiny text-primary-dark/70">Payment is taken at the property on arrival. Please quote your confirmation number when you check in.</p> : null}
      </Card>

      <p className="text-small text-secondary-light">
        Need to change or cancel this booking? Please contact {booking.property.name} directly — changes can&rsquo;t be made online yet.
      </p>

      <div>
        <Button type="button" variant="outline" onClick={onLookupAnother}>
          Look up another booking
        </Button>
      </div>
    </Section>
  );
}
