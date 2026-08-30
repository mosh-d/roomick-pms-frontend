'use client';

import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select, type SelectOption } from '@/components/ui/Select';
import { SearchInput } from '@/components/ui/SearchInput';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { CommsLogIcon, CommsChannelIcon } from '@/components/ui/Icons';
import { useReservationCommunicationsQuery, useSendCommunicationMutation, type CommunicationLogEntry, type DeliveryStatus } from '@/lib/comms-log';
import { useReservationsQuery } from '@/lib/reservations';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

const DELIVERY_TONE: Record<DeliveryStatus, string> = {
  queued: 'bg-secondary-light/20 text-secondary',
  sent: 'bg-amber-100 text-amber-800',
  delivered: 'bg-green-50 text-green-700',
  opened: 'bg-green-50 text-green-700',
  failed: 'bg-red-100 text-red-700',
  bounced: 'bg-red-100 text-red-700',
};

const TRIGGER_LABELS: Record<string, string> = {
  booking_confirmation: 'Booking Confirmation',
  checkin_receipt: 'Check-In Receipt',
  post_stay: 'Post-Stay',
  no_show_notice: 'No-Show Notice',
  cancellation: 'Cancellation',
  manual: 'Manual',
};

const CHANNEL_OPTIONS: SelectOption[] = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
];

/**
 * Guest Communications Log (ref: MVP timeline Month 5). The reference route
 * is guest-profile-scoped (`/guests/:guestId/comms`), but this app has no
 * Guest Profile hub page yet to hang a tab off of — so, matching how Guest
 * Registration Card solved the identical "no natural home" problem, this is
 * its own reservation-centric hub: search a reservation, see its full
 * timeline, send a one-off message. `GET /guests/:guestId/communications`
 * exists on the backend and is ready the moment a guest profile page does.
 */
export default function CommsLogPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [search, setSearch] = useState('');
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);

  const searchQuery = useReservationsQuery(activeBranchId, { search }, auth, search.trim().length > 0);
  const commsQuery = useReservationCommunicationsQuery(selectedReservationId, auth);
  const selectedReservation = (searchQuery.data ?? []).find((r) => r.id === selectedReservationId);

  if (!activeBranchId) return null;

  return (
    <Container className="max-w-4xl py-10 flex flex-col gap-8">
      <PageHeader
        icon={<CommsLogIcon className="size-8" />}
        title="Guest Communications Log"
        subtitle="Complete history of every automated and manual communication sent to a guest, attached to both the reservation and guest profile."
        roles="Front Desk · Manager"
      />

      <Section label="Find a Reservation">
        <SearchInput value={search} onChange={setSearch} placeholder="Confirmation number or guest name" label="Search reservations" />
        {search.trim() ? (
          searchQuery.isLoading ? (
            <p className="text-body text-primary-dark/70">Searching…</p>
          ) : (searchQuery.data ?? []).length === 0 ? (
            <p className="text-body text-primary-dark/70">No matching reservations.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {(searchQuery.data ?? []).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedReservationId(r.id)}
                  className={`text-left rounded-card border p-3 transition-colors cursor-pointer ${
                    r.id === selectedReservationId ? 'border-primary bg-primary-light/20' : 'border-accent/30 hover:bg-accent/5'
                  }`}
                >
                  <p className="text-body font-semibold text-primary-dark">{r.guest.name}</p>
                  <p className="text-small text-primary-dark/70">
                    {r.confirmationNumber} — {r.roomType.name}, {r.checkInDate} to {r.checkOutDate}
                  </p>
                </button>
              ))}
            </div>
          )
        ) : null}
      </Section>

      {selectedReservationId ? (
        <>
          <SendMessageSection reservationId={selectedReservationId} guestName={selectedReservation?.guest.name} auth={auth} />

          <Section label="Timeline">
            {commsQuery.isLoading ? (
              <p className="text-body text-primary-dark/70">Loading…</p>
            ) : (commsQuery.data ?? []).length === 0 ? (
              <p className="text-body text-primary-dark/70">No communications logged for this reservation yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {(commsQuery.data ?? []).map((entry) => (
                  <TimelineEntry key={entry.id} entry={entry} />
                ))}
              </div>
            )}
          </Section>
        </>
      ) : null}
    </Container>
  );
}

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

function TimelineEntry({ entry }: { entry: CommunicationLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <Card tone="secondary" className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="text-secondary mt-0.5">
            <CommsChannelIcon channel={entry.channel} className="size-4" />
          </span>
          <div>
            <p className="text-body font-semibold text-secondary">{entry.subject ?? TRIGGER_LABELS[entry.trigger] ?? entry.trigger}</p>
            <p className="text-tiny text-secondary-light">
              {TRIGGER_LABELS[entry.trigger] ?? entry.trigger} · {new Date(entry.sentAt).toLocaleString()} · {entry.sentBy ? 'Manual' : 'Automated'}
            </p>
          </div>
        </div>
        <span className={`inline-flex items-center rounded-pill px-2 py-0.5 text-tiny font-semibold whitespace-nowrap ${DELIVERY_TONE[entry.deliveryStatus]}`}>{entry.deliveryStatus}</span>
      </div>
      {expanded ? (
        <p className="text-small text-secondary whitespace-pre-wrap">{entry.body}</p>
      ) : (
        <button type="button" onClick={() => setExpanded(true)} className="text-small text-primary text-left cursor-pointer hover:underline self-start">
          Expand message
        </button>
      )}
    </Card>
  );
}

function SendMessageSection({ reservationId, guestName, auth }: { reservationId: string; guestName: string | undefined; auth: AuthOpts }) {
  const [channel, setChannel] = useState<string | null>('email');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const mutation = useSendCommunicationMutation(auth);

  async function send() {
    if (!channel || !body.trim()) return;
    setError(null);
    setSent(false);
    try {
      await mutation.mutateAsync({ reservationId, channel: channel as 'email' | 'sms', subject: subject.trim() || undefined, body: body.trim() });
      setSubject('');
      setBody('');
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Section label="Send Manual Message">
      {guestName ? <p className="text-small text-primary-dark/70">To {guestName}</p> : null}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 max-w-xl">
        <Select name="channel" label="Channel" options={CHANNEL_OPTIONS} value={channel} onChange={setChannel} />
        {channel === 'email' ? <Input name="subject" label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} /> : null}
      </div>
      <div className="max-w-xl">
        <Textarea name="body" label="Message" value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
      </div>
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {sent ? <p className="text-small text-primary-dark">Logged.</p> : null}
      <Button type="button" disabled={!body.trim()} loading={mutation.isPending} onClick={send} className="self-start">
        Send
      </Button>
    </Section>
  );
}
