'use client';

import { useEffect, useState } from 'react';
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
import {
  useInboxQuery,
  useInboxReplyMutation,
  useInboxThreadQuery,
  useMarkThreadReadMutation,
  useReservationCommunicationsQuery,
  useSendCommunicationMutation,
  type CommsChannel,
  type CommunicationLogEntry,
  type DeliveryStatus,
  type InboxConversation,
  type InboxReplyChannel,
} from '@/lib/comms-log';
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
  guest_message: 'Guest Message',
  guest_request: 'Guest Request',
};

const CHANNEL_OPTIONS: SelectOption[] = [
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
];

const CHANNEL_LABELS: Record<CommsChannel, string> = { email: 'Email', sms: 'SMS', push: 'Push', in_app_chat: 'Guest portal' };

const REPLY_CHANNEL_OPTIONS: SelectOption[] = [
  { value: 'in_app_chat', label: 'Guest portal' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
];

/** Said plainly next to the reply box — only the portal actually reaches a guest until an email/SMS provider is connected. */
const REPLY_CHANNEL_HINTS: Record<InboxReplyChannel, string> = {
  in_app_chat: 'Appears on the guest’s Manage your booking page straight away.',
  email: 'Recorded and queued. No email provider is connected yet, so it isn’t delivered to the guest.',
  sms: 'Recorded only. No SMS provider is connected yet, so it won’t reach the guest.',
};

/**
 * Guest Communications Log (ref: MVP timeline Month 5). The reference route
 * is guest-profile-scoped (`/guests/:guestId/comms`), but this app has no
 * Guest Profile hub page yet to hang a tab off of — so, matching how Guest
 * Registration Card solved the identical "no natural home" problem, this is
 * its own reservation-centric hub: search a reservation, see its full
 * timeline, send a one-off message. `GET /guests/:guestId/communications`
 * exists on the backend and is ready the moment a guest profile page does.
 *
 * Since Month 9 it also holds the unified inbox ("Guest Messages") — here
 * rather than as a new sidebar item, because the sidebar mirrors the
 * reference exactly and this is the page that already owns guest
 * communication. Guests write in from "Manage your booking"; each thread
 * shows their messages alongside everything the property has sent them.
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

      <GuestInboxSection branchId={activeBranchId} auth={auth} />

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

/**
 * The unified inbox (growth plan Month 9): one conversation per guest who has
 * written in, whatever channel they used, newest activity first. Polls every
 * 30 seconds while open, so a new message shows up without a refresh.
 */
function GuestInboxSection({ branchId, auth }: { branchId: string; auth: AuthOpts }) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [guestId, setGuestId] = useState<string | null>(null);
  const inboxQuery = useInboxQuery(branchId, filter, auth);
  const conversations = inboxQuery.data ?? [];

  return (
    <Section label="Guest Messages">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-small text-primary-dark/70 max-w-xl">
          Messages and requests guests send from Manage your booking, threaded with everything the property has sent them.
        </p>
        <div className="flex gap-2" role="group" aria-label="Show">
          <Button type="button" size="sm" variant={filter === 'all' ? undefined : 'outline'} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            All
          </Button>
          <Button type="button" size="sm" variant={filter === 'unread' ? undefined : 'outline'} aria-pressed={filter === 'unread'} onClick={() => setFilter('unread')}>
            Unread
          </Button>
        </div>
      </div>

      {inboxQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading messages…</p>
      ) : conversations.length === 0 ? (
        <p className="text-body text-primary-dark/70">{filter === 'unread' ? 'No unread guest messages.' : 'No guest has sent a message yet.'}</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4 items-start">
          <ul className="flex flex-col gap-2" aria-label="Conversations">
            {conversations.map((conversation) => (
              <li key={conversation.guest.id}>
                <ConversationButton conversation={conversation} selected={conversation.guest.id === guestId} onSelect={() => setGuestId(conversation.guest.id)} />
              </li>
            ))}
          </ul>
          {guestId ? (
            <InboxThreadPanel key={guestId} branchId={branchId} guestId={guestId} auth={auth} />
          ) : (
            <p className="text-small text-primary-dark/70">Pick a conversation to read and reply.</p>
          )}
        </div>
      )}
    </Section>
  );
}

function ConversationButton({ conversation, selected, onSelect }: { conversation: InboxConversation; selected: boolean; onSelect: () => void }) {
  const { guest, reservation, lastMessage, unreadCount } = conversation;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={`w-full text-left rounded-card border p-3 transition-colors cursor-pointer ${
        selected ? 'border-primary bg-primary-light/20' : 'border-accent/30 hover:bg-accent/5'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={`text-body text-primary-dark ${unreadCount > 0 ? 'font-bold' : 'font-semibold'}`}>{guest.name}</p>
        {unreadCount > 0 ? (
          <span className="inline-flex items-center rounded-pill bg-primary px-2 py-0.5 text-tiny font-semibold text-white whitespace-nowrap">{unreadCount} new</span>
        ) : null}
      </div>
      <p className="text-tiny text-primary-dark/70">
        {reservation ? `${reservation.confirmationNumber} · ${reservation.status.replace('_', ' ')}` : 'No booking'} · {new Date(lastMessage.sentAt).toLocaleString()}
      </p>
      <p className="text-small text-primary-dark/80 truncate">
        {lastMessage.direction === 'inbound' ? '' : 'You: '}
        {lastMessage.preview}
      </p>
    </button>
  );
}

function InboxThreadPanel({ branchId, guestId, auth }: { branchId: string; guestId: string; auth: AuthOpts }) {
  const threadQuery = useInboxThreadQuery(branchId, guestId, auth);
  const { mutate: markThreadRead } = useMarkThreadReadMutation(branchId, auth);
  const replyMutation = useInboxReplyMutation(branchId, auth);
  const [channel, setChannel] = useState<InboxReplyChannel>('in_app_chat');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const thread = threadQuery.data;
  const unreadCount = (thread?.messages ?? []).filter((m) => m.direction === 'inbound' && !m.readAt).length;

  // Opening a thread (or a new message arriving while it's open) reads it.
  useEffect(() => {
    if (unreadCount > 0) markThreadRead(guestId);
  }, [unreadCount, guestId, markThreadRead]);

  async function sendReply() {
    if (!body.trim()) return;
    setError(null);
    setSent(false);
    try {
      await replyMutation.mutateAsync({ guestId, channel, subject: channel === 'email' ? subject.trim() || undefined : undefined, body: body.trim() });
      setBody('');
      setSubject('');
      setSent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  if (threadQuery.isLoading || !thread) {
    return <p className="text-body text-primary-dark/70">Loading conversation…</p>;
  }

  return (
    <Card tone="secondary" className="flex flex-col gap-3">
      <div>
        <p className="text-body font-bold text-secondary">{thread.guest.name}</p>
        <p className="text-tiny text-secondary-light">
          {[thread.guest.email, thread.guest.phone].filter(Boolean).join(' · ') || 'No contact details'}
          {thread.reservations.length > 0 ? ` · ${thread.reservations.map((r) => `${r.confirmationNumber} (${r.status.replace('_', ' ')})`).join(', ')}` : ''}
        </p>
      </div>

      <ol className="flex flex-col gap-2 max-h-112 overflow-y-auto" aria-label="Messages">
        {thread.messages.map((message) => (
          <ThreadMessage key={message.id} message={message} />
        ))}
      </ol>

      <div className="flex flex-col gap-2 border-t border-secondary/20 pt-3">
        <Select id="reply-channel" label="Reply by" options={REPLY_CHANNEL_OPTIONS} value={channel} onChange={(value) => setChannel(value as InboxReplyChannel)} />
        <p className="text-tiny text-secondary-light">{REPLY_CHANNEL_HINTS[channel]}</p>
        {channel === 'email' ? <Input id="reply-subject" label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} /> : null}
        <Textarea id="reply-body" label="Reply" value={body} rows={3} maxLength={5000} onChange={(e) => { setBody(e.target.value); setSent(false); }} />
        {error ? <p className="text-small text-red-600">{error}</p> : null}
        {sent ? <p className="text-small text-secondary">Reply sent.</p> : null}
        <Button type="button" disabled={!body.trim()} loading={replyMutation.isPending} onClick={sendReply} className="self-start">
          Send reply
        </Button>
      </div>
    </Card>
  );
}

function ThreadMessage({ message }: { message: CommunicationLogEntry }) {
  const fromGuest = message.direction === 'inbound';
  const who = fromGuest ? 'Guest' : message.sentBy ? 'Staff' : `Automated · ${TRIGGER_LABELS[message.trigger] ?? message.trigger}`;
  return (
    <li className={`rounded-control p-3 ${fromGuest ? 'bg-accent/15 mr-8' : 'bg-white/60 ml-8 border border-secondary/10'}`}>
      <p className="flex flex-wrap items-center gap-1 text-tiny text-secondary-light">
        <CommsChannelIcon channel={message.channel} className="size-3" />
        <span>
          {who} · {CHANNEL_LABELS[message.channel]} · {new Date(message.sentAt).toLocaleString()}
        </span>
      </p>
      {message.subject ? <p className="text-small font-semibold text-secondary">{message.subject}</p> : null}
      <p className="text-small text-secondary whitespace-pre-wrap wrap-break-word">{message.body}</p>
    </li>
  );
}

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
              {TRIGGER_LABELS[entry.trigger] ?? entry.trigger} · {new Date(entry.sentAt).toLocaleString()} ·{' '}
              {entry.direction === 'inbound' ? 'From guest' : entry.sentBy ? 'Manual' : 'Automated'}
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
