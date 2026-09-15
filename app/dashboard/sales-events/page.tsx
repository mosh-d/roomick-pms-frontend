'use client';

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
import {
  SETUP_STYLE_LABELS,
  downloadBeo,
  seatsFor,
  useBookIntoGroupBlockMutation,
  useCancelEventBookingMutation,
  useCreateEventBookingMutation,
  useCreateEventSpaceMutation,
  useCreateGroupBlockMutation,
  useEventBookingQuery,
  useEventBookingsQuery,
  useEventSpacesQuery,
  useGroupBlocksQuery,
  useImportRoomingListMutation,
  useReleaseGroupBlockMutation,
  useUpdateEventBookingMutation,
  type CateringLine,
  type EventBookingDetail,
  type EventSpaceSummary,
  type GroupBlockSummary,
  type RoomingListResult,
  type RoomingListRow,
  type SetupStyle,
} from '@/lib/salesEvents';
import { useRoomTypesQuery } from '@/lib/rooms';
import { ApiError } from '@/lib/api';
import { currencySymbolFor } from '@/lib/currencies';
import { formatMoney } from '@/lib/numberFormat';
import { useAuthStore } from '@/lib/store/authStore';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

const CATEGORY_OPTIONS = [
  { value: 'meeting_room', label: 'Meeting Room' },
  { value: 'ballroom', label: 'Ballroom' },
  { value: 'outdoor', label: 'Outdoor' },
];

const SETUP_STYLES = Object.keys(SETUP_STYLE_LABELS) as SetupStyle[];

function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

function defaultMonthRange(): { from: string; to: string } {
  const from = new Date();
  const to = new Date(from.getTime() + 30 * 86400000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function formatDay(value: string): string {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`).toLocaleDateString(undefined, { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
}

/** Whole days from today (the viewer's calendar) to a date-only value. */
function daysUntil(dateOnly: string): number {
  const now = new Date();
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(`${dateOnly.slice(0, 10)}T00:00:00.000Z`).getTime() - today) / 86_400_000);
}

function Badge({ className, children }: { className: string; children: React.ReactNode }) {
  return <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-tiny font-semibold ${className}`}>{children}</span>;
}

/**
 * Sales & Events (ref p19). A group block now HOLDS rooms: until its cut-off
 * its unbooked allotment is out of general availability for the group's
 * nights, then goes back on sale on its own. Booking into a block — one guest
 * or a whole rooming list — makes ordinary reservations at the block's rate.
 * Events carry their Banquet Event Order: layout, headcount checked against
 * the space's seats, contact, priced catering, AV, and a printable BEO.
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

// --- Group blocks ---------------------------------------------------------------

function GroupBlocksSection({ branchId, auth }: { branchId: string; auth: AuthOpts }) {
  const blocksQuery = useGroupBlocksQuery(branchId, auth);
  const roomTypesQuery = useRoomTypesQuery(branchId, auth);
  const createMutation = useCreateGroupBlockMutation(branchId, auth);

  const [name, setName] = useState('');
  const [roomTypeId, setRoomTypeId] = useState<string | null>(null);
  const [blockSize, setBlockSize] = useState('');
  const [blockRate, setBlockRate] = useState('');
  const [arrivalDate, setArrivalDate] = useState('');
  const [departureDate, setDepartureDate] = useState('');
  const [cutoffDate, setCutoffDate] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [bookingBlock, setBookingBlock] = useState<GroupBlockSummary | null>(null);
  const [listBlock, setListBlock] = useState<GroupBlockSummary | null>(null);
  const [releaseBlock, setReleaseBlock] = useState<GroupBlockSummary | null>(null);

  const roomTypeOptions = useMemo(() => (roomTypesQuery.data ?? []).map((rt) => ({ value: rt.id, label: rt.name })), [roomTypesQuery.data]);
  const ready = roomTypeId && name.trim() && blockSize && blockRate && arrivalDate && departureDate && cutoffDate;

  async function create() {
    if (!ready || !roomTypeId) return;
    setError(null);
    try {
      await createMutation.mutateAsync({
        name: name.trim(),
        roomTypeId,
        blockSize: Number(blockSize),
        blockRate: Number(blockRate),
        arrivalDate,
        departureDate,
        cutoffDate,
        contactName: contactName.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
      });
      setName('');
      setBlockSize('');
      setBlockRate('');
      setArrivalDate('');
      setDepartureDate('');
      setCutoffDate('');
      setContactName('');
      setContactEmail('');
      setContactPhone('');
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <Section label="Group Block Creation">
      <p className="text-small text-primary-dark/70">
        A block holds its rooms for the group&rsquo;s nights until the end of the cut-off date. After that, any rooms not yet booked go back on sale by themselves.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2">
        <Input id="group-block-name" label="Block Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Acme Corp Annual Conference" />
        <Select id="group-block-room-type" label="Room Type" options={roomTypeOptions} value={roomTypeId} onChange={setRoomTypeId} />
        <Input id="group-block-size" label="Rooms Allotted" type="number" min={1} value={blockSize} onChange={(e) => setBlockSize(e.target.value)} />
        <Input id="group-block-rate" label="Nightly Rate" type="number" min={0} value={blockRate} onChange={(e) => setBlockRate(e.target.value)} />
        <Input id="group-block-arrival" label="Arrival" type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} />
        <Input id="group-block-departure" label="Departure" type="date" min={arrivalDate || undefined} value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} />
        <Input
          id="group-block-cutoff"
          label="Cut-Off Date"
          type="date"
          max={arrivalDate || undefined}
          value={cutoffDate}
          onChange={(e) => setCutoffDate(e.target.value)}
          hint="The last day rooms are held for the group — on or before arrival."
        />
        <Input id="group-block-contact-name" label="Group Contact (optional)" value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Jane Smith" />
        <Input id="group-block-contact-email" label="Contact Email (optional)" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        <Input id="group-block-contact-phone" label="Contact Phone (optional)" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
      </div>
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div>
        <Button type="button" onClick={create} loading={createMutation.isPending} disabled={!ready}>
          Create Block
        </Button>
      </div>

      {blocksQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading…</p>
      ) : (blocksQuery.data ?? []).length === 0 ? (
        <p className="text-body text-primary-dark/70">No group blocks yet.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {(blocksQuery.data ?? []).map((block) => (
            <GroupBlockCard key={block.id} block={block} onBook={setBookingBlock} onRoomingList={setListBlock} onRelease={setReleaseBlock} />
          ))}
        </div>
      )}

      {bookingBlock ? <BookIntoBlockModal key={bookingBlock.id} block={bookingBlock} branchId={branchId} auth={auth} onClose={() => setBookingBlock(null)} /> : null}
      {listBlock ? <RoomingListModal key={listBlock.id} block={listBlock} branchId={branchId} auth={auth} onClose={() => setListBlock(null)} /> : null}
      {releaseBlock ? <ReleaseBlockModal key={releaseBlock.id} block={releaseBlock} branchId={branchId} auth={auth} onClose={() => setReleaseBlock(null)} /> : null}
    </Section>
  );
}

function HoldStatus({ block }: { block: GroupBlockSummary }) {
  if (block.holdState === 'holding') {
    const days = daysUntil(block.cutoffDate);
    const when = days <= 0 ? 'cut-off today' : days === 1 ? 'cut-off tomorrow' : `cut-off in ${days} days`;
    return (
      <Badge className="bg-green-100 text-green-800">
        Holding {block.roomsHeld} room{block.roomsHeld === 1 ? '' : 's'} · {when}
      </Badge>
    );
  }
  if (block.holdState === 'lapsed') return <Badge className="bg-orange-100 text-orange-800">Cut-off passed — unbooked rooms back on sale</Badge>;
  if (block.holdState === 'released') return <Badge className="bg-secondary/10 text-secondary-light">Released</Badge>;
  return <Badge className="bg-secondary/10 text-secondary-light">No rooms held — no stay dates</Badge>;
}

function GroupBlockCard({
  block,
  onBook,
  onRoomingList,
  onRelease,
}: {
  block: GroupBlockSummary;
  onBook: (block: GroupBlockSummary) => void;
  onRoomingList: (block: GroupBlockSummary) => void;
  onRelease: (block: GroupBlockSummary) => void;
}) {
  const pickupPct = Math.min(100, Math.round((block.pickup / block.blockSize) * 100));
  const contact = [block.contactName, block.contactPhone, block.contactEmail].filter(Boolean).join(' · ');
  return (
    <Card tone="secondary" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-body font-semibold text-secondary">{block.name}</p>
          <p className="text-small text-secondary-light">
            {block.roomTypeName} · {formatMoney(block.blockRate)}/night
            {block.arrivalDate && block.departureDate ? ` · ${formatDay(block.arrivalDate)} – ${formatDay(block.departureDate)}` : ''}
          </p>
          {contact ? <p className="text-tiny text-secondary-light">Contact: {contact}</p> : null}
        </div>
        <HoldStatus block={block} />
      </div>
      <div>
        <div className="flex justify-between text-tiny text-secondary">
          <span>Pickup</span>
          <span>
            {block.pickup} of {block.blockSize} rooms booked
          </span>
        </div>
        <div
          className="mt-1 h-2 rounded-pill bg-secondary/10"
          role="progressbar"
          aria-label={`${block.name} pickup`}
          aria-valuemin={0}
          aria-valuemax={block.blockSize}
          aria-valuenow={block.pickup}
        >
          <div className="h-2 rounded-pill bg-primary" style={{ width: `${pickupPct}%` }} />
        </div>
        <p className="mt-1 text-tiny text-secondary-light">Cut-off {formatDay(block.cutoffDate)}</p>
      </div>
      {block.status === 'active' ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => onBook(block)} disabled={block.pickup >= block.blockSize}>
            Book Into Block
          </Button>
          <Button size="sm" variant="outline" onClick={() => onRoomingList(block)} disabled={block.pickup >= block.blockSize}>
            Upload Rooming List
          </Button>
          <Button size="sm" variant="outline" onClick={() => onRelease(block)}>
            Release
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

function ReleaseBlockModal({ block, branchId, auth, onClose }: { block: GroupBlockSummary; branchId: string; auth: AuthOpts; onClose: () => void }) {
  const mutation = useReleaseGroupBlockMutation(branchId, auth);
  const [error, setError] = useState<string | null>(null);

  async function release() {
    setError(null);
    try {
      await mutation.mutateAsync(block.id);
      onClose();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <Modal open onClose={onClose} title={`Release "${block.name}"?`}>
      <p className="text-body text-secondary">
        It stops taking bookings
        {block.roomsHeld > 0 ? ` and its ${block.roomsHeld} held room${block.roomsHeld === 1 ? '' : 's'} go back on sale` : ''}. The {block.pickup} room
        {block.pickup === 1 ? '' : 's'} already booked stay booked.
      </p>
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Keep It
        </Button>
        <Button type="button" variant="danger" onClick={release} loading={mutation.isPending}>
          Release Block
        </Button>
      </div>
    </Modal>
  );
}

function BookIntoBlockModal({ block, branchId, auth, onClose }: { block: GroupBlockSummary; branchId: string; auth: AuthOpts; onClose: () => void }) {
  const bookMutation = useBookIntoGroupBlockMutation(branchId, auth);
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [checkInDate, setCheckInDate] = useState(block.arrivalDate?.slice(0, 10) ?? '');
  const [checkOutDate, setCheckOutDate] = useState(block.departureDate?.slice(0, 10) ?? '');
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
      setError(errorText(err));
    }
  }

  return (
    <Modal open onClose={onClose} title={`Book Into "${block.name}"`}>
      {confirmation ? (
        <div className="flex flex-col gap-3">
          <p className="text-body text-primary-dark">
            Booked — confirmation <span className="font-semibold">{confirmation}</span> at {formatMoney(block.blockRate)}/night.
          </p>
          <Button type="button" onClick={onClose} className="self-start">
            Done
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-small text-primary-dark/70">
            {block.pickup} of {block.blockSize} rooms booked so far — this reservation takes the block&rsquo;s own rate of {formatMoney(block.blockRate)}/night.
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

// --- Rooming list upload --------------------------------------------------------------

const TEMPLATE_HEADER = ['Guest name', 'Email', 'Phone', 'Check-in', 'Check-out', 'Adults', 'Children', 'Requests'];

const COLUMN_ALIASES: Record<keyof RoomingListRow, string[]> = {
  guestName: ['guest name', 'name', 'guest', 'full name'],
  email: ['email', 'e-mail', 'email address'],
  phone: ['phone', 'telephone', 'mobile', 'phone number'],
  checkInDate: ['check-in', 'check in', 'checkin', 'arrival', 'arrival date'],
  checkOutDate: ['check-out', 'check out', 'checkout', 'departure', 'departure date'],
  adults: ['adults'],
  children: ['children', 'kids'],
  specialRequests: ['requests', 'special requests', 'notes'],
};

/** CSV as spreadsheets save it: quoted fields may hold commas, line breaks and doubled quotes. Blank lines are dropped. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''));
}

/** `YYYY-MM-DD` as it is, and `DD/MM/YYYY` — how a spreadsheet set to Nigerian or British dates saves them. Blank = `undefined`; anything else = `null`. */
function toIsoDate(value: string): string | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  return null;
}

function readRoomingList(text: string): { rows: RoomingListRow[]; problems: string[] } {
  const table = parseCsv(text.replace(/^﻿/, ''));
  if (table.length < 2) return { rows: [], problems: ['The file needs a row of column names and at least one guest.'] };
  const header = table[0].map((cell) => cell.trim().toLowerCase());
  const column = (key: keyof RoomingListRow) => header.findIndex((cell) => COLUMN_ALIASES[key].includes(cell));
  if (column('guestName') < 0) {
    return { rows: [], problems: ['There’s no “Guest name” column — the first row should be the column names. Download the template to see them.'] };
  }

  const rows: RoomingListRow[] = [];
  const problems: string[] = [];
  table.slice(1).forEach((cells, index) => {
    const rowNumber = index + 1;
    const get = (key: keyof RoomingListRow) => {
      const at = column(key);
      return at >= 0 ? (cells[at] ?? '').trim() : '';
    };
    const row: RoomingListRow = { guestName: get('guestName') };
    if (!row.guestName) problems.push(`Row ${rowNumber}: no guest name`);
    if (get('email')) row.email = get('email');
    if (get('phone')) row.phone = get('phone');
    if (get('specialRequests')) row.specialRequests = get('specialRequests');
    for (const key of ['checkInDate', 'checkOutDate'] as const) {
      const date = toIsoDate(get(key));
      if (date === null) problems.push(`Row ${rowNumber}: “${get(key)}” isn’t a date — use YYYY-MM-DD or DD/MM/YYYY`);
      else if (date) row[key] = date;
    }
    for (const key of ['adults', 'children'] as const) {
      const raw = get(key);
      if (!raw) continue;
      const count = Number(raw);
      if (!Number.isInteger(count) || count < 0) problems.push(`Row ${rowNumber}: “${raw}” isn’t a number of ${key}`);
      else row[key] = count;
    }
    rows.push(row);
  });
  return { rows, problems };
}

function downloadTemplate() {
  const csv = `${TEMPLATE_HEADER.join(',')}\r\nNgozi Eze,ngozi@example.com,0803 123 4567,,,2,0,Ground floor please\r\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'rooming-list-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function RoomingListModal({ block, branchId, auth, onClose }: { block: GroupBlockSummary; branchId: string; auth: AuthOpts; onClose: () => void }) {
  const mutation = useImportRoomingListMutation(branchId, auth);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<{ rows: RoomingListRow[]; problems: string[] } | null>(null);
  const [result, setResult] = useState<RoomingListResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const remaining = block.blockSize - block.pickup;
  const blockDates = block.arrivalDate && block.departureDate ? `${formatDay(block.arrivalDate)} – ${formatDay(block.departureDate)}` : null;

  async function chooseFile(file: File | undefined) {
    setError(null);
    setResult(null);
    if (!file) return;
    setFileName(file.name);
    if (/\.xlsx?$/i.test(file.name)) {
      setParsed({ rows: [], problems: ['That’s a spreadsheet file — save it as CSV first (File › Save As › CSV), then choose that.'] });
      return;
    }
    setParsed(readRoomingList(await file.text()));
  }

  async function book() {
    if (!parsed || parsed.rows.length === 0) return;
    setError(null);
    try {
      setResult(await mutation.mutateAsync({ blockId: block.id, rows: parsed.rows }));
    } catch (err) {
      setError(errorText(err));
    }
  }

  const tooMany = parsed !== null && parsed.rows.length > remaining;

  return (
    <Modal open onClose={onClose} title={`Rooming List — ${block.name}`}>
      <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
        {result ? (
          <>
            <p className="text-body font-semibold text-secondary">
              Booked {result.created.length} of {result.created.length + result.failed.length} guests.
            </p>
            {result.created.length > 0 ? (
              <ul className="text-small text-secondary list-disc pl-5">
                {result.created.map((c) => (
                  <li key={c.reservationId}>
                    {c.guestName} — {c.confirmationNumber}
                  </li>
                ))}
              </ul>
            ) : null}
            {result.failed.length > 0 ? (
              <>
                <p className="text-small font-semibold text-red-700">Not booked:</p>
                <ul className="text-small text-red-700 list-disc pl-5">
                  {result.failed.map((f) => (
                    <li key={f.row}>
                      Row {f.row}, {f.guestName}: {f.message}
                    </li>
                  ))}
                </ul>
                <p className="text-tiny text-secondary-light">Fix these and book them one by one, or upload a list of just these guests.</p>
              </>
            ) : null}
            <Button type="button" onClick={onClose} className="self-start">
              Done
            </Button>
          </>
        ) : (
          <>
            <p className="text-small text-primary-dark/70">
              One row per guest, from a CSV file. Leave the dates blank to use the block&rsquo;s own{blockDates ? ` (${blockDates})` : ''}. {remaining} of the
              block&rsquo;s {block.blockSize} rooms are left.
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" variant="outline" onClick={downloadTemplate}>
                Download Template
              </Button>
              <label className="inline-flex cursor-pointer items-center rounded-control border border-black px-3 py-1.5 text-small font-semibold text-black hover:bg-black hover:text-white focus-within:ring-2 focus-within:ring-primary">
                Choose CSV File
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => chooseFile(e.target.files?.[0])} />
              </label>
              {fileName ? <span className="text-tiny text-secondary-light">{fileName}</span> : null}
            </div>

            {parsed && parsed.problems.length > 0 ? (
              <ul className="text-small text-red-700 list-disc pl-5">
                {parsed.problems.slice(0, 8).map((problem) => (
                  <li key={problem}>{problem}</li>
                ))}
                {parsed.problems.length > 8 ? <li>…and {parsed.problems.length - 8} more</li> : null}
              </ul>
            ) : null}

            {parsed && parsed.problems.length === 0 && parsed.rows.length > 0 ? (
              <>
                <p className="text-small text-secondary">
                  {parsed.rows.length} guest{parsed.rows.length === 1 ? '' : 's'} ready to book.
                  {tooMany ? <span className="text-red-700"> That&rsquo;s more than the {remaining} rooms left.</span> : null}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-tiny text-secondary">
                    <thead>
                      <tr className="text-left font-bold">
                        <th className="py-1 pr-3">Row</th>
                        <th className="py-1 pr-3">Guest</th>
                        <th className="py-1 pr-3">Stay</th>
                        <th className="py-1 pr-3">Adults</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.rows.slice(0, 8).map((row, index) => (
                        <tr key={`${index}-${row.guestName}`} className="border-t border-secondary/10">
                          <td className="py-1 pr-3">{index + 1}</td>
                          <td className="py-1 pr-3">{row.guestName}</td>
                          <td className="py-1 pr-3">{row.checkInDate || row.checkOutDate ? `${row.checkInDate ?? 'block'} – ${row.checkOutDate ?? 'block'}` : 'Block dates'}</td>
                          <td className="py-1 pr-3">{row.adults ?? 1}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsed.rows.length > 8 ? <p className="text-tiny text-secondary-light">…and {parsed.rows.length - 8} more.</p> : null}
                </div>
              </>
            ) : null}

            {error ? <p className="text-small text-red-600">{error}</p> : null}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={book}
                loading={mutation.isPending}
                disabled={!parsed || parsed.problems.length > 0 || parsed.rows.length === 0 || tooMany}
              >
                {parsed && parsed.rows.length > 0 ? `Book ${parsed.rows.length} Guest${parsed.rows.length === 1 ? '' : 's'}` : 'Book Guests'}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

// --- Event spaces and bookings ------------------------------------------------------------

function EventSpacesSection({ branchId, auth }: { branchId: string; auth: AuthOpts }) {
  const spacesQuery = useEventSpacesQuery(branchId, auth);
  const createSpaceMutation = useCreateEventSpaceMutation(branchId, auth);
  const [{ from, to }] = useState(defaultMonthRange);
  const fromIso = `${from}T00:00:00.000Z`;
  const toIso = `${to}T00:00:00.000Z`;
  const bookingsQuery = useEventBookingsQuery(branchId, fromIso, toIso, auth);
  const createBookingMutation = useCreateEventBookingMutation(branchId, fromIso, toIso, auth);
  const cancelBookingMutation = useCancelEventBookingMutation(branchId, fromIso, toIso, auth);

  const [spaceName, setSpaceName] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [capacity, setCapacity] = useState('');
  const [layoutSeats, setLayoutSeats] = useState<Record<SetupStyle, string>>({ theater: '', classroom: '', banquet: '', u_shape: '' });
  const [spaceError, setSpaceError] = useState<string | null>(null);

  const [bookingSpaceId, setBookingSpaceId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [setupStyle, setSetupStyle] = useState<string | null>(null);
  const [headcount, setHeadcount] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const spaces = spacesQuery.data ?? [];
  const spaceById = useMemo(() => new Map((spacesQuery.data ?? []).map((s) => [s.id, s])), [spacesQuery.data]);
  const chosenSpace = bookingSpaceId ? (spaceById.get(bookingSpaceId) ?? null) : null;
  const layoutOptions = SETUP_STYLES.map((style) => ({
    value: style,
    label: chosenSpace ? `${SETUP_STYLE_LABELS[style]} — seats ${seatsFor(chosenSpace, style)}` : SETUP_STYLE_LABELS[style],
  }));

  async function createSpace() {
    if (!spaceName.trim() || !category || !capacity) return;
    setSpaceError(null);
    const setupCapacities: Partial<Record<SetupStyle, number>> = {};
    for (const style of SETUP_STYLES) if (layoutSeats[style]) setupCapacities[style] = Number(layoutSeats[style]);
    try {
      await createSpaceMutation.mutateAsync({
        name: spaceName.trim(),
        category,
        capacity: Number(capacity),
        setupCapacities: Object.keys(setupCapacities).length > 0 ? setupCapacities : undefined,
      });
      setSpaceName('');
      setCategory(null);
      setCapacity('');
      setLayoutSeats({ theater: '', classroom: '', banquet: '', u_shape: '' });
    } catch (err) {
      setSpaceError(errorText(err));
    }
  }

  async function createBooking() {
    if (!bookingSpaceId || !title.trim() || !startsAt || !endsAt) return;
    setBookingError(null);
    try {
      await createBookingMutation.mutateAsync({
        eventSpaceId: bookingSpaceId,
        title: title.trim(),
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        setupStyle: (setupStyle as SetupStyle | null) ?? undefined,
        headcount: headcount ? Number(headcount) : undefined,
        contactName: contactName.trim() || undefined,
        contactPhone: contactPhone.trim() || undefined,
        contactEmail: contactEmail.trim() || undefined,
      });
      setTitle('');
      setStartsAt('');
      setEndsAt('');
      setSetupStyle(null);
      setHeadcount('');
      setContactName('');
      setContactPhone('');
      setContactEmail('');
    } catch (err) {
      setBookingError(errorText(err));
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
          <p className="text-tiny text-secondary-light">Seats per layout (optional) — a layout left blank uses the capacity above.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl">
            {SETUP_STYLES.map((style) => (
              <Input
                key={style}
                id={`event-space-seats-${style}`}
                label={SETUP_STYLE_LABELS[style]}
                type="number"
                min={1}
                value={layoutSeats[style]}
                onChange={(e) => setLayoutSeats((current) => ({ ...current, [style]: e.target.value }))}
              />
            ))}
          </div>
          {spaceError ? <p className="text-small text-red-600">{spaceError}</p> : null}
          <Button type="button" variant="outline" onClick={createSpace} loading={createSpaceMutation.isPending} disabled={!spaceName.trim() || !category || !capacity} className="self-start">
            Add Space
          </Button>
        </Card>

        {spaces.length === 0 ? (
          <p className="text-body text-primary-dark/70">No event spaces registered yet.</p>
        ) : (
          <>
            <Card tone="accent" className="flex flex-col gap-3">
              <p className="text-small font-semibold text-primary-dark">Book a Space</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl">
                <Select
                  id="event-booking-space"
                  label="Space"
                  options={spaces.map((s) => ({ value: s.id, label: `${s.name} (${s.capacity})` }))}
                  value={bookingSpaceId}
                  onChange={setBookingSpaceId}
                />
                <Input id="event-booking-title" label="Title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Acme Corp Product Launch" />
                <Input id="event-booking-starts" label="Starts" type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
                <Input id="event-booking-ends" label="Ends" type="datetime-local" min={startsAt || undefined} value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
                <Select id="event-booking-layout" label="Layout (optional)" options={layoutOptions} value={setupStyle} onChange={setSetupStyle} placeholder="Choose a layout" />
                <Input id="event-booking-headcount" label="Guaranteed Headcount (optional)" type="number" min={1} value={headcount} onChange={(e) => setHeadcount(e.target.value)} />
                <Input id="event-booking-contact-name" label="Contact Name (optional)" value={contactName} onChange={(e) => setContactName(e.target.value)} />
                <Input id="event-booking-contact-phone" label="Contact Phone (optional)" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
                <Input id="event-booking-contact-email" label="Contact Email (optional)" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
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

            <p className="text-small text-primary-dark/70">
              Showing bookings from {from} to {to}.
            </p>
            {bookingsQuery.isLoading ? (
              <p className="text-body text-primary-dark/70">Loading…</p>
            ) : (bookingsQuery.data ?? []).length === 0 ? (
              <p className="text-body text-primary-dark/70">No bookings in this range.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {(bookingsQuery.data ?? []).map((booking) => (
                  <Card key={booking.id} tone="secondary" className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-body font-semibold text-secondary">{booking.title}</p>
                      <p className="text-tiny text-secondary-light">
                        {spaceById.get(booking.eventSpaceId)?.name ?? 'Unknown space'} · {new Date(booking.startsAt).toLocaleString()} – {new Date(booking.endsAt).toLocaleString()}
                      </p>
                      {booking.setupStyle || booking.headcount ? (
                        <p className="text-tiny text-secondary-light">
                          {[booking.setupStyle ? SETUP_STYLE_LABELS[booking.setupStyle] : null, booking.headcount ? `${booking.headcount} guests` : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setDetailId(booking.id)}>
                        Details &amp; BEO
                      </Button>
                      <Button size="sm" variant="outline" loading={cancelBookingMutation.isPending} onClick={() => cancelBookingMutation.mutate(booking.id)}>
                        Cancel
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
      {detailId ? <EventDetailsModal key={detailId} bookingId={detailId} branchId={branchId} from={fromIso} to={toIso} auth={auth} onClose={() => setDetailId(null)} /> : null}
    </Section>
  );
}

function EventDetailsModal({
  bookingId,
  branchId,
  from,
  to,
  auth,
  onClose,
}: {
  bookingId: string;
  branchId: string;
  from: string;
  to: string;
  auth: AuthOpts;
  onClose: () => void;
}) {
  const detailQuery = useEventBookingQuery(bookingId, auth);
  const detail = detailQuery.data;
  return (
    <Modal open onClose={onClose} title={detail ? detail.title : 'Event Details'}>
      {detailQuery.isError ? <p className="text-small text-red-600">{errorText(detailQuery.error)}</p> : null}
      {detail ? <EventDetailsForm key={detail.id} detail={detail} branchId={branchId} from={from} to={to} auth={auth} /> : <p className="text-body text-primary-dark/70">Loading…</p>}
    </Modal>
  );
}

type CateringDraft = { description: string; quantity: string; unitPrice: string };

function EventDetailsForm({ detail, branchId, from, to, auth }: { detail: EventBookingDetail; branchId: string; from: string; to: string; auth: AuthOpts }) {
  const mutation = useUpdateEventBookingMutation(branchId, from, to, auth);
  const [setupStyle, setSetupStyle] = useState<string | null>(detail.setupStyle);
  const [headcount, setHeadcount] = useState(detail.headcount ? String(detail.headcount) : '');
  const [contactName, setContactName] = useState(detail.contactName ?? '');
  const [contactPhone, setContactPhone] = useState(detail.contactPhone ?? '');
  const [contactEmail, setContactEmail] = useState(detail.contactEmail ?? '');
  const [lines, setLines] = useState<CateringDraft[]>(
    detail.catering.map((line) => ({ description: line.description, quantity: String(line.quantity), unitPrice: String(line.unitPrice) })),
  );
  const [avRequirements, setAvRequirements] = useState(detail.avRequirements ?? '');
  const [notes, setNotes] = useState(detail.notes ?? '');
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [downloading, setDownloading] = useState(false);
  const symbol = currencySymbolFor(detail.currency);
  const space: EventSpaceSummary = detail.space;

  const setLine = (index: number, patch: Partial<CateringDraft>) => setLines((current) => current.map((line, i) => (i === index ? { ...line, ...patch } : line)));

  async function save(): Promise<boolean> {
    setMessage(null);
    const catering: CateringLine[] = [];
    for (const [index, line] of lines.entries()) {
      if (!line.description.trim() && !line.quantity && !line.unitPrice) continue;
      const quantity = Number(line.quantity);
      const unitPrice = Number(line.unitPrice);
      if (!line.description.trim() || !Number.isInteger(quantity) || quantity < 1 || line.unitPrice === '' || !Number.isFinite(unitPrice) || unitPrice < 0) {
        setMessage({ kind: 'error', text: `Catering line ${index + 1} needs an item, a whole-number quantity and a price.` });
        return false;
      }
      catering.push({ description: line.description.trim(), quantity, unitPrice });
    }
    try {
      await mutation.mutateAsync({
        bookingId: detail.id,
        setupStyle: (setupStyle as SetupStyle | null) ?? null,
        headcount: headcount ? Number(headcount) : null,
        contactName: contactName.trim() || null,
        contactPhone: contactPhone.trim() || null,
        contactEmail: contactEmail.trim() || null,
        catering,
        avRequirements: avRequirements.trim() || null,
        notes: notes.trim() || null,
      });
      setMessage({ kind: 'ok', text: 'Saved.' });
      return true;
    } catch (err) {
      setMessage({ kind: 'error', text: errorText(err) });
      return false;
    }
  }

  async function saveAndDownload() {
    if (!(await save())) return;
    setDownloading(true);
    try {
      await downloadBeo(detail, auth);
    } catch (err) {
      setMessage({ kind: 'error', text: errorText(err) });
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1">
      <p className="text-small text-secondary-light">
        {space.name} · {new Date(detail.startsAt).toLocaleString()} – {new Date(detail.endsAt).toLocaleString()}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Select
          id="event-detail-layout"
          label="Layout"
          options={SETUP_STYLES.map((style) => ({ value: style, label: `${SETUP_STYLE_LABELS[style]} — seats ${seatsFor(space, style)}` }))}
          value={setupStyle}
          onChange={setSetupStyle}
          placeholder="Choose a layout"
        />
        <Input id="event-detail-headcount" label="Guaranteed Headcount" type="number" min={1} value={headcount} onChange={(e) => setHeadcount(e.target.value)} />
        <Input id="event-detail-contact-name" label="Contact Name" value={contactName} onChange={(e) => setContactName(e.target.value)} />
        <Input id="event-detail-contact-phone" label="Contact Phone" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        <Input id="event-detail-contact-email" label="Contact Email" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-small font-semibold text-secondary">Catering</p>
          <Button type="button" size="sm" variant="outline" onClick={() => setLines((current) => [...current, { description: '', quantity: '', unitPrice: '' }])}>
            Add Line
          </Button>
        </div>
        {lines.length === 0 ? <p className="text-tiny text-secondary-light">No catering yet.</p> : null}
        {lines.map((line, index) => (
          <Card key={index} tone="secondary" className="flex flex-col gap-2">
            <Input
              id={`event-detail-catering-${index}-item`}
              label={`Item ${index + 1}`}
              value={line.description}
              onChange={(e) => setLine(index, { description: e.target.value })}
              placeholder="Buffet lunch"
              maxLength={200}
            />
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
              <Input id={`event-detail-catering-${index}-qty`} label="Qty" type="number" min={1} value={line.quantity} onChange={(e) => setLine(index, { quantity: e.target.value })} />
              <Input
                id={`event-detail-catering-${index}-price`}
                label="Unit Price"
                type="number"
                min={0}
                step="0.01"
                value={line.unitPrice}
                onChange={(e) => setLine(index, { unitPrice: e.target.value })}
              />
              <Button type="button" size="sm" variant="outline" className="mb-2" onClick={() => setLines((current) => current.filter((_, i) => i !== index))} aria-label={`Remove item ${index + 1}`}>
                Remove
              </Button>
            </div>
          </Card>
        ))}
        {detail.cateringLines.length > 0 ? (
          <dl className="flex flex-col gap-1 border-t border-secondary/20 pt-2 text-small text-secondary">
            <div className="flex justify-between">
              <dt>Subtotal</dt>
              <dd>{formatMoney(detail.totals.subtotal, symbol)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>Tax (estimate, branch F&amp;B rules)</dt>
              <dd>{formatMoney(detail.totals.taxTotal, symbol)}</dd>
            </div>
            <div className="flex justify-between font-bold">
              <dt>Total</dt>
              <dd>{formatMoney(detail.totals.total, symbol)}</dd>
            </div>
            <p className="text-tiny text-secondary-light">As last saved.</p>
          </dl>
        ) : null}
      </div>

      <Textarea id="event-detail-av" label="AV & Equipment" value={avRequirements} onChange={(e) => setAvRequirements(e.target.value)} placeholder="Projector, 2 wireless mics" maxLength={2000} />
      <Textarea id="event-detail-notes" label="Notes & Special Instructions" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />

      {message ? <p className={`text-small ${message.kind === 'error' ? 'text-red-600' : 'text-green-700'}`}>{message.text}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={save} loading={mutation.isPending && !downloading}>
          Save
        </Button>
        <Button type="button" variant="outline" onClick={saveAndDownload} loading={downloading}>
          Save &amp; Download BEO
        </Button>
      </div>
    </div>
  );
}
