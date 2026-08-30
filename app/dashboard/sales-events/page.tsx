'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  useGroupBlocksQuery,
  useCreateGroupBlockMutation,
  useReleaseGroupBlockMutation,
  useBookIntoGroupBlockMutation,
  useEventSpacesQuery,
  useCreateEventSpaceMutation,
  useEventBookingsQuery,
  useCreateEventBookingMutation,
  useCancelEventBookingMutation,
  type GroupBlockSummary,
} from '@/lib/salesEvents';
import { useRoomTypesQuery } from '@/lib/rooms';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

const CATEGORY_OPTIONS = [
  { value: 'meeting_room', label: 'Meeting Room' },
  { value: 'ballroom', label: 'Ballroom' },
  { value: 'outdoor', label: 'Outdoor' },
];

function defaultMonthRange(): { from: string; to: string } {
  const from = new Date();
  const to = new Date(from.getTime() + 30 * 86400000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

/**
 * Sales & Events (ref p19). Group Block Creation reuses the SAME
 * `Reservation.overrideRate` mechanism Manager Dashboard's own Rate
 * Override already established — booking into a block is a real
 * reservation, not a parallel booking system. Event Space Calendar is a
 * genuinely new, small domain: a booking is a time range on a venue, not a
 * night on a room.
 */
export default function SalesEventsPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  if (!activeBranchId) return null;

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader title="Sales & Events" subtitle="Group blocks, corporate contracts, event space management, BEOs." roles="Sales · Events Manager" />

      <GroupBlocksSection branchId={activeBranchId} auth={auth} />
      <EventSpacesSection branchId={activeBranchId} auth={auth} />
    </Container>
  );
}

function GroupBlocksSection({ branchId, auth }: { branchId: string; auth: AuthOpts }) {
  const blocksQuery = useGroupBlocksQuery(branchId, auth);
  const roomTypesQuery = useRoomTypesQuery(branchId, auth);
  const createMutation = useCreateGroupBlockMutation(branchId, auth);
  const releaseMutation = useReleaseGroupBlockMutation(branchId, auth);

  const [name, setName] = useState('');
  const [roomTypeId, setRoomTypeId] = useState<string | null>(null);
  const [blockSize, setBlockSize] = useState('');
  const [blockRate, setBlockRate] = useState('');
  const [cutoffDate, setCutoffDate] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bookingBlock, setBookingBlock] = useState<GroupBlockSummary | null>(null);

  const roomTypeOptions = useMemo(() => (roomTypesQuery.data ?? []).map((rt) => ({ value: rt.id, label: rt.name })), [roomTypesQuery.data]);

  async function create() {
    if (!roomTypeId || !name.trim() || !blockSize || !blockRate || !cutoffDate) return;
    setError(null);
    try {
      await createMutation.mutateAsync({ name: name.trim(), roomTypeId, blockSize: Number(blockSize), blockRate: Number(blockRate), cutoffDate });
      setName('');
      setBlockSize('');
      setBlockRate('');
      setCutoffDate('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Section label="Group Block Creation">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 max-w-2xl">
        <Input id="group-block-name" label="Block Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp Annual Conference" />
        <Select id="group-block-room-type" label="Room Type" options={roomTypeOptions} value={roomTypeId} onChange={setRoomTypeId} />
        <Input id="group-block-size" label="Rooms Allotted" type="number" min={1} value={blockSize} onChange={(e) => setBlockSize(e.target.value)} />
        <Input id="group-block-rate" label="Nightly Rate" type="number" min={0} value={blockRate} onChange={(e) => setBlockRate(e.target.value)} />
        <Input id="group-block-cutoff" label="Cut-Off Date" type="date" value={cutoffDate} onChange={(e) => setCutoffDate(e.target.value)} />
      </div>
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div>
        <Button type="button" onClick={create} loading={createMutation.isPending} disabled={!roomTypeId || !name.trim() || !blockSize || !blockRate || !cutoffDate}>
          Create Block
        </Button>
      </div>

      {blocksQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading…</p>
      ) : (blocksQuery.data ?? []).length === 0 ? (
        <p className="text-body text-primary-dark/70">No group blocks yet.</p>
      ) : (
        <Card tone="secondary" className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-small font-bold text-secondary text-left">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Room Type</th>
                <th className="py-2 pr-4">Rate</th>
                <th className="py-2 pr-4">Pickup</th>
                <th className="py-2 pr-4">Cut-Off</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {(blocksQuery.data ?? []).map((block) => (
                <tr key={block.id} className="border-t border-secondary/10 text-small text-secondary">
                  <td className="py-2 pr-4">{block.name}</td>
                  <td className="py-2 pr-4">{block.roomTypeName}</td>
                  <td className="py-2 pr-4">{block.blockRate}</td>
                  <td className="py-2 pr-4">
                    {block.pickup} / {block.blockSize}
                  </td>
                  <td className="py-2 pr-4">{new Date(block.cutoffDate).toLocaleDateString()}</td>
                  <td className="py-2 pr-4 capitalize">{block.status}</td>
                  <td className="py-2 pr-4">
                    {block.status === 'active' ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => setBookingBlock(block)}>
                          Book Into Block
                        </Button>
                        <Button size="sm" variant="outline" loading={releaseMutation.isPending} onClick={() => releaseMutation.mutate(block.id)}>
                          Release
                        </Button>
                      </div>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {bookingBlock ? <BookIntoBlockModal key={bookingBlock.id} block={bookingBlock} branchId={branchId} auth={auth} onClose={() => setBookingBlock(null)} /> : null}
    </Section>
  );
}

function BookIntoBlockModal({ block, branchId, auth, onClose }: { block: GroupBlockSummary; branchId: string; auth: AuthOpts; onClose: () => void }) {
  const bookMutation = useBookIntoGroupBlockMutation(branchId, auth);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [adults, setAdults] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);

  async function submit() {
    if (!guestName.trim() || !checkInDate || !checkOutDate || !adults) return;
    setError(null);
    try {
      const result = await bookMutation.mutateAsync({
        blockId: block.id,
        guest: { name: guestName.trim(), email: guestEmail.trim() || undefined },
        checkInDate,
        checkOutDate,
        adults: Number(adults),
      });
      setConfirmation(result.confirmationNumber);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Modal open onClose={onClose} title={`Book Into "${block.name}"`}>
      {confirmation ? (
        <div className="flex flex-col gap-3">
          <p className="text-body text-primary-dark">
            Booked — confirmation <span className="font-semibold">{confirmation}</span> at {block.blockRate}/night.
          </p>
          <Button type="button" onClick={onClose} className="self-start">
            Done
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-small text-primary-dark/70">
            {block.pickup} of {block.blockSize} rooms booked so far — this reservation applies the block&rsquo;s own rate of {block.blockRate}/night.
          </p>
          <Input id="block-booking-guest-name" label="Guest Name" value={guestName} onChange={(e) => setGuestName(e.target.value)} />
          <Input id="block-booking-guest-email" label="Guest Email (optional)" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input id="block-booking-checkin" label="Check-In" type="date" value={checkInDate} onChange={(e) => setCheckInDate(e.target.value)} />
            <Input id="block-booking-checkout" label="Check-Out" type="date" min={checkInDate || undefined} value={checkOutDate} onChange={(e) => setCheckOutDate(e.target.value)} />
          </div>
          <Input id="block-booking-adults" label="Adults" type="number" min={1} max={20} value={adults} onChange={(e) => setAdults(e.target.value)} />
          {error ? <p className="text-small text-red-600">{error}</p> : null}
          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" onClick={submit} loading={bookMutation.isPending} disabled={!guestName.trim() || !checkInDate || !checkOutDate}>
              Book
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function EventSpacesSection({ branchId, auth }: { branchId: string; auth: AuthOpts }) {
  const spacesQuery = useEventSpacesQuery(branchId, auth);
  const createSpaceMutation = useCreateEventSpaceMutation(branchId, auth);
  const [{ from, to }] = useState(defaultMonthRange);
  const bookingsQuery = useEventBookingsQuery(branchId, `${from}T00:00:00.000Z`, `${to}T00:00:00.000Z`, auth);
  const createBookingMutation = useCreateEventBookingMutation(branchId, `${from}T00:00:00.000Z`, `${to}T00:00:00.000Z`, auth);
  const cancelBookingMutation = useCancelEventBookingMutation(branchId, `${from}T00:00:00.000Z`, `${to}T00:00:00.000Z`, auth);

  const [spaceName, setSpaceName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [capacity, setCapacity] = useState('');
  const [spaceError, setSpaceError] = useState<string | null>(null);

  const [bookingSpaceId, setBookingSpaceId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [bookingError, setBookingError] = useState<string | null>(null);

  const spaceOptions = useMemo(() => (spacesQuery.data ?? []).map((s) => ({ value: s.id, label: s.name })), [spacesQuery.data]);
  const spaceNameById = useMemo(() => new Map((spacesQuery.data ?? []).map((s) => [s.id, s.name])), [spacesQuery.data]);

  async function createSpace() {
    if (!spaceName.trim() || !category || !capacity) return;
    setSpaceError(null);
    try {
      await createSpaceMutation.mutateAsync({ name: spaceName.trim(), category, capacity: Number(capacity) });
      setSpaceName('');
      setCategory(null);
      setCapacity('');
    } catch (err) {
      setSpaceError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  async function createBooking() {
    if (!bookingSpaceId || !title.trim() || !startsAt || !endsAt) return;
    setBookingError(null);
    try {
      await createBookingMutation.mutateAsync({ eventSpaceId: bookingSpaceId, title: title.trim(), startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString() });
      setTitle('');
      setStartsAt('');
      setEndsAt('');
    } catch (err) {
      setBookingError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Section label="Event Space Calendar">
      <div className="flex flex-col gap-4">
        <Card tone="accent" className="flex flex-col gap-3">
          <p className="text-small font-semibold text-primary-dark">Register a Space</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 max-w-2xl">
            <Input id="event-space-name" label="Name" value={spaceName} onChange={(e) => setSpaceName(e.target.value)} placeholder="Grand Ballroom" />
            <Select id="event-space-category" label="Category" options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
            <Input id="event-space-capacity" label="Capacity" type="number" min={1} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
          {spaceError ? <p className="text-small text-red-600">{spaceError}</p> : null}
          <Button type="button" variant="outline" onClick={createSpace} loading={createSpaceMutation.isPending} disabled={!spaceName.trim() || !category || !capacity} className="self-start">
            Add Space
          </Button>
        </Card>

        {(spacesQuery.data ?? []).length === 0 ? (
          <p className="text-body text-primary-dark/70">No event spaces registered yet.</p>
        ) : (
          <>
            <Card tone="accent" className="flex flex-col gap-3">
              <p className="text-small font-semibold text-primary-dark">Book a Space</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                <Select id="event-booking-space" label="Space" options={spaceOptions} value={bookingSpaceId} onChange={setBookingSpaceId} />
                <Input id="event-booking-title" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Acme Corp Product Launch" />
                <Input id="event-booking-starts" label="Starts" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                <Input id="event-booking-ends" label="Ends" type="datetime-local" min={startsAt || undefined} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
              {bookingError ? <p className="text-small text-red-600">{bookingError}</p> : null}
              <Button
                type="button"
                variant="outline"
                onClick={createBooking}
                loading={createBookingMutation.isPending}
                disabled={!bookingSpaceId || !title.trim() || !startsAt || !endsAt}
                className="self-start"
              >
                Add Booking
              </Button>
            </Card>

            <p className="text-small text-primary-dark/70">Showing bookings from {from} to {to}.</p>
            {bookingsQuery.isLoading ? (
              <p className="text-body text-primary-dark/70">Loading…</p>
            ) : (bookingsQuery.data ?? []).length === 0 ? (
              <p className="text-body text-primary-dark/70">No bookings in this range.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {(bookingsQuery.data ?? []).map((booking) => (
                  <Card key={booking.id} tone="secondary" className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-body font-semibold text-secondary">{booking.title}</p>
                      <p className="text-tiny text-secondary-light">
                        {spaceNameById.get(booking.eventSpaceId) ?? 'Unknown space'} · {new Date(booking.startsAt).toLocaleString()} – {new Date(booking.endsAt).toLocaleString()}
                      </p>
                    </div>
                    <Button size="sm" variant="outline" loading={cancelBookingMutation.isPending} onClick={() => cancelBookingMutation.mutate(booking.id)}>
                      Cancel
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </Section>
  );
}
