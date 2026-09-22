'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PageHeader } from '@/components/ui/PageHeader';
import { BackButton } from '@/components/ui/BackButton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Table, type TableColumn } from '@/components/ui/Table';
import { EmailCampaignIcon } from '@/components/ui/Icons';
import { ApiError } from '@/lib/api';
import {
  CONVERSION_WINDOW_DAYS,
  formatRate,
  useCampaignQuery,
  useCancelCampaignMutation,
  usePreviewSegmentMutation,
  useSegmentsQuery,
  useSendCampaignMutation,
  useSendTestMutation,
  useUpdateCampaignMutation,
  type Campaign,
} from '@/lib/marketing';
import { useAuthStore } from '@/lib/store/authStore';
import { CampaignStatusBadge, DeliveryNotice, formatWhen } from '../_components/campaignUi';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

/** `datetime-local` wants the viewer's own clock, without seconds or a zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function CampaignPage() {
  const params = useParams<{ campaignId: string }>();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };
  const campaign = useCampaignQuery(params.campaignId, auth);

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <BackButton fallbackHref="/dashboard/loyalty/campaigns" />
      {campaign.isError ? (
        <p className="text-small text-red-600">{errorText(campaign.error, 'Couldn’t load this campaign.')}</p>
      ) : !campaign.data ? (
        <p className="text-small text-secondary">Loading…</p>
      ) : (
        <CampaignContent key={campaign.data.id} campaign={campaign.data} auth={auth} staffEmail={user?.email ?? ''} />
      )}
    </Container>
  );
}

function CampaignContent({ campaign, auth, staffEmail }: { campaign: Campaign; auth: AuthOpts; staffEmail: string }) {
  const editable = campaign.status === 'draft' || campaign.status === 'scheduled' || campaign.status === 'failed';
  const hasResults = campaign.performance.recipients > 0;

  return (
    <>
      <PageHeader icon={<EmailCampaignIcon className="size-6" />} title={campaign.name} subtitle="Email campaign" roles="Marketing · Manager" />
      <DeliveryNotice auth={auth} />
      <Section label="Campaign">
        <Card className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <CampaignStatusBadge status={campaign.status} />
            <span className="text-small text-secondary">
              {campaign.sentAt ? `Sent ${formatWhen(campaign.sentAt)}` : campaign.scheduledAt ? `Scheduled for ${formatWhen(campaign.scheduledAt)}` : 'Not scheduled'}
            </span>
          </div>
          {campaign.failureReason ? (
            <p className="text-small text-red-700" id="campaign-failure">
              {campaign.status === 'failed' ? 'Not sent: ' : ''}
              {campaign.failureReason}
            </p>
          ) : null}
          <dl className="grid grid-cols-1 sm:grid-cols-[9rem_1fr] gap-x-4 gap-y-1 text-small text-secondary">
            <dt className="font-semibold">Audience</dt>
            <dd>
              {campaign.segment.name}
              <span className="text-secondary/70"> — {campaign.segment.rules.join('; ')}</span>
            </dd>
            <dt className="font-semibold">Template</dt>
            <dd>
              {campaign.template.name}
              {campaign.variantTemplate
                ? ` (A, ${Math.round(Number(campaign.splitRatio) * 100)}%) vs ${campaign.variantTemplate.name} (B, ${100 - Math.round(Number(campaign.splitRatio) * 100)}%)`
                : ''}
            </dd>
            {campaign.subject ? (
              <>
                <dt className="font-semibold">Subject</dt>
                <dd>{campaign.subject}</dd>
              </>
            ) : null}
          </dl>
        </Card>
      </Section>

      {editable ? <SendSection campaign={campaign} auth={auth} staffEmail={staffEmail} /> : null}
      {hasResults ? <PerformanceSection campaign={campaign} /> : null}
      {hasResults ? <RecipientsSection campaign={campaign} /> : null}
    </>
  );
}

function SendSection({ campaign, auth, staffEmail }: { campaign: Campaign; auth: AuthOpts; staffEmail: string }) {
  const sendTest = useSendTestMutation(campaign.id, auth);
  const send = useSendCampaignMutation(campaign.id, auth);
  const update = useUpdateCampaignMutation(campaign.id, auth);
  const cancel = useCancelCampaignMutation(campaign.id, auth);
  const segments = useSegmentsQuery(auth);
  const audience = usePreviewSegmentMutation(auth);

  const [testEmail, setTestEmail] = useState(staffEmail);
  const [scheduledAt, setScheduledAt] = useState(toLocalInput(campaign.scheduledAt));
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  function runTest() {
    setMessage(null);
    sendTest.mutate(testEmail.trim(), {
      onSuccess: (result) => setMessage({ kind: 'ok', text: `Test sent to ${result.sentTo}. It isn’t counted and isn’t recorded against any guest.` }),
      onError: (err) => setMessage({ kind: 'error', text: errorText(err, 'Couldn’t send the test.') }),
    });
  }

  /** Counts the audience before the confirmation, so "Send" is never pressed without knowing how many people it reaches. */
  function askToSend() {
    setMessage(null);
    const criteria = segments.data?.find((segment) => segment.id === campaign.segment.id)?.criteria;
    if (criteria) audience.mutate(criteria);
    setConfirming(true);
  }

  function sendNow() {
    setConfirming(false);
    send.mutate(undefined, {
      onSuccess: (result) => setMessage({ kind: 'ok', text: `Queued ${result.recipientCount.toLocaleString()} ${result.recipientCount === 1 ? 'email' : 'emails'} for delivery.` }),
      onError: (err) => setMessage({ kind: 'error', text: errorText(err, 'Couldn’t send the campaign.') }),
    });
  }

  function saveSchedule(clear: boolean) {
    setMessage(null);
    update.mutate(
      { scheduledAt: clear || !scheduledAt ? null : new Date(scheduledAt).toISOString() },
      {
        onSuccess: (result) => {
          if (clear) setScheduledAt('');
          setMessage({ kind: 'ok', text: result.scheduledAt ? `Scheduled for ${formatWhen(result.scheduledAt)}.` : 'Schedule cleared — it’s a draft again.' });
        },
        onError: (err) => setMessage({ kind: 'error', text: errorText(err, 'Couldn’t save the schedule.') }),
      },
    );
  }

  const reach = audience.data;
  const confirmText = audience.isPending
    ? 'Counting the audience…'
    : reach
      ? `This sends one email to each of ${reach.reachable.toLocaleString()} ${reach.reachable === 1 ? 'guest' : 'guests'} in “${campaign.segment.name}” who opted in. It can’t be undone.`
      : `This sends one email to every guest in “${campaign.segment.name}” who opted in. It can’t be undone.`;

  return (
    <Section label="Send">
      <Card className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-end max-w-xl">
          <Input id="campaign-test-email" label="Send a test to" type="email" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
          <Button type="button" variant="outline" className="mb-2" onClick={runTest} loading={sendTest.isPending} disabled={!testEmail.includes('@')}>
            Send Test
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-3 items-end max-w-xl border-t border-secondary/20 pt-3">
          <Input id="campaign-reschedule" label="Send at" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} hint="Your computer’s local time." />
          <Button type="button" variant="outline" className="mb-7" onClick={() => saveSchedule(false)} loading={update.isPending} disabled={!scheduledAt}>
            Save Schedule
          </Button>
          {campaign.scheduledAt ? (
            <Button type="button" variant="outline" className="mb-7" onClick={() => saveSchedule(true)} disabled={update.isPending}>
              Clear
            </Button>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-3 border-t border-secondary/20 pt-3">
          <Button type="button" onClick={askToSend} loading={send.isPending}>
            Send Now
          </Button>
          {campaign.status !== 'failed' ? (
            <Button
              type="button"
              variant="outline"
              onClick={() =>
                cancel.mutate(undefined, { onError: (err) => setMessage({ kind: 'error', text: errorText(err, 'Couldn’t cancel the campaign.') }) })
              }
              loading={cancel.isPending}
            >
              Cancel Campaign
            </Button>
          ) : null}
        </div>
        {message ? (
          <p id="campaign-message" className={`text-small ${message.kind === 'error' ? 'text-red-600' : 'text-green-700'}`}>
            {message.text}
          </p>
        ) : null}
      </Card>
      <ConfirmDialog
        open={confirming}
        title="Send this campaign now?"
        description={confirmText}
        confirmLabel="Send"
        onConfirm={sendNow}
        onCancel={() => setConfirming(false)}
      />
    </Section>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <Card className="flex flex-col gap-0.5">
      <p className="text-tiny text-secondary/70">{label}</p>
      <p className="text-header font-bold text-secondary">{value}</p>
      {detail ? <p className="text-tiny text-secondary/70">{detail}</p> : null}
    </Card>
  );
}

function PerformanceSection({ campaign }: { campaign: Campaign }) {
  const p = campaign.performance;
  return (
    <Section label="Performance">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3" id="campaign-performance">
        <Stat label="Recipients" value={p.recipients.toLocaleString()} />
        <Stat label="Delivered" value={p.sent.toLocaleString()} detail={p.queued ? `${p.queued} waiting` : p.failed ? `${p.failed} failed` : undefined} />
        <Stat label="Opened" value={formatRate(p.openRate, 1)} detail={`${p.opened} ${p.opened === 1 ? 'guest' : 'guests'}`} />
        <Stat label="Clicked" value={formatRate(p.clickRate, 1)} detail={`${p.clicked} ${p.clicked === 1 ? 'guest' : 'guests'}`} />
        <Stat label="Unsubscribed" value={p.unsubscribed.toLocaleString()} />
        <Stat label={`Booked within ${CONVERSION_WINDOW_DAYS} days`} value={p.bookingsAfterSend === null ? '—' : p.bookingsAfterSend.toLocaleString()} />
      </div>
      <p className="text-tiny text-secondary/70 max-w-3xl">
        The open rate is a floor: many mail clients block the tracking image, and a click counts as an open. Bookings are reservations these guests made at
        this property after the send — a sign of interest, not proof the email caused them.
      </p>
      {p.byVariant.length > 1 ? (
        <table className="w-full max-w-lg text-small text-secondary" id="campaign-ab-results">
          <thead>
            <tr className="text-left text-tiny text-secondary/70">
              <th className="py-1">Variant</th>
              <th className="py-1 text-right">Recipients</th>
              <th className="py-1 text-right">Opened</th>
              <th className="py-1 text-right">Clicked</th>
            </tr>
          </thead>
          <tbody>
            {p.byVariant.map((row) => (
              <tr key={row.variant} className="border-t border-secondary/10">
                <td className="py-1">
                  {row.variant} — {row.variant === 'B' ? campaign.variantTemplate?.name : campaign.template.name}
                </td>
                <td className="py-1 text-right">{row.recipients}</td>
                <td className="py-1 text-right">
                  {row.opened} ({formatRate(row.recipients ? row.opened / row.recipients : null)})
                </td>
                <td className="py-1 text-right">
                  {row.clicked} ({formatRate(row.recipients ? row.clicked / row.recipients : null)})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </Section>
  );
}

const DELIVERY_LABELS: Record<string, string> = {
  queued: 'Waiting',
  sent: 'Delivered',
  delivered: 'Delivered',
  opened: 'Opened',
  failed: 'Failed',
  bounced: 'Bounced',
};

function RecipientsSection({ campaign }: { campaign: Campaign }) {
  type Row = Campaign['recipients'][number];
  const columns: TableColumn<Row>[] = [
    { key: 'guest', label: 'Guest', render: (row) => row.guestName, sortValue: (row) => row.guestName },
    { key: 'email', label: 'Email', render: (row) => row.email ?? '—' },
    ...(campaign.variantTemplate ? [{ key: 'variant', label: 'Variant', render: (row: Row) => row.variant }] : []),
    { key: 'status', label: 'Status', render: (row) => (row.deliveryStatus ? (DELIVERY_LABELS[row.deliveryStatus] ?? row.deliveryStatus) : '—') },
    { key: 'opened', label: 'Opened', render: (row) => (row.openedAt ? formatWhen(row.openedAt) : '—') },
    { key: 'clicked', label: 'Clicked', render: (row) => (row.clickedAt ? formatWhen(row.clickedAt) : '—') },
    { key: 'unsubscribed', label: 'Unsubscribed', render: (row) => (row.unsubscribedAt ? formatWhen(row.unsubscribedAt) : '—') },
  ];
  return (
    <Section label="Recipients">
      {campaign.performance.recipients > campaign.recipients.length ? (
        <p className="text-tiny text-secondary/70">
          Showing the first {campaign.recipients.length} of {campaign.performance.recipients.toLocaleString()}.
        </p>
      ) : null}
      <Table columns={columns} rows={campaign.recipients} emptyMessage="Nobody yet." />
    </Section>
  );
}
