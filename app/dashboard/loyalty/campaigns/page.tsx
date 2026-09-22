'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Select } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { PageHeader } from '@/components/ui/PageHeader';
import { BackButton } from '@/components/ui/BackButton';
import { MultiSelectTagInput } from '@/components/ui/MultiSelectTagInput';
import { Table, type TableColumn } from '@/components/ui/Table';
import { EmailCampaignIcon } from '@/components/ui/Icons';
import { ApiError } from '@/lib/api';
import { useLoyaltyProgramQuery } from '@/lib/loyalty';
import {
  formatRate,
  useCreateCampaignMutation,
  useCampaignsQuery,
  useDeleteSegmentMutation,
  useDeleteTemplateMutation,
  useMergeFieldsQuery,
  usePreviewSegmentMutation,
  usePreviewTemplateMutation,
  useSaveSegmentMutation,
  useSaveTemplateMutation,
  useSegmentsQuery,
  useTemplatesQuery,
  type CampaignSummary,
  type MessageTemplate,
  type Segment,
  type SegmentCriteria,
  type SegmentPreview,
} from '@/lib/marketing';
import { useAuthStore } from '@/lib/store/authStore';
import { CampaignStatusBadge, DeliveryNotice, formatWhen } from './_components/campaignUi';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

const errorText = (err: unknown, fallback: string) => (err instanceof ApiError ? err.message : fallback);

/**
 * Email Campaign Builder (ref p21, Loyalty & Marketing). Three things live
 * here: audiences (saved segments), templates, and the campaigns that pair
 * one of each. Sending, testing and performance are on each campaign's own
 * page — this one is for building.
 */
export default function CampaignsPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const branchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <BackButton fallbackHref="/dashboard/loyalty" />
      <PageHeader
        icon={<EmailCampaignIcon className="size-6" />}
        title="Email Campaigns"
        subtitle="Audiences, templates, and campaigns that only ever reach guests who opted in."
        roles="Marketing · Manager"
      />
      <DeliveryNotice auth={auth} />
      <CampaignsSection auth={auth} branchId={branchId} />
      <SegmentsSection auth={auth} />
      <TemplatesSection auth={auth} />
    </Container>
  );
}

// ---------------------------------------------------------------------------
// Campaigns
// ---------------------------------------------------------------------------

function CampaignsSection({ auth, branchId }: { auth: AuthOpts; branchId: string | null }) {
  const router = useRouter();
  const campaigns = useCampaignsQuery(branchId, auth);
  const [creating, setCreating] = useState(false);

  const columns: TableColumn<CampaignSummary>[] = [
    { key: 'name', label: 'Campaign', render: (row) => <span className="font-semibold">{row.name}</span>, sortValue: (row) => row.name },
    { key: 'status', label: 'Status', render: (row) => <CampaignStatusBadge status={row.status} /> },
    { key: 'audience', label: 'Audience', render: (row) => row.segmentName },
    {
      key: 'when',
      label: 'When',
      render: (row) => (row.sentAt ? `Sent ${formatWhen(row.sentAt)}` : row.scheduledAt ? `Scheduled ${formatWhen(row.scheduledAt)}` : '—'),
      sortValue: (row) => row.sentAt ?? row.scheduledAt ?? '',
    },
    { key: 'recipients', label: 'Recipients', align: 'right', render: (row) => row.recipientCount.toLocaleString(), sortValue: (row) => row.recipientCount },
    {
      key: 'opened',
      label: 'Opened',
      align: 'right',
      render: (row) => (row.recipientCount ? `${row.opened} (${formatRate(row.opened / row.recipientCount)})` : '—'),
      sortValue: (row) => row.opened,
    },
    {
      key: 'clicked',
      label: 'Clicked',
      align: 'right',
      render: (row) => (row.recipientCount ? `${row.clicked} (${formatRate(row.clicked / row.recipientCount)})` : '—'),
      sortValue: (row) => row.clicked,
    },
    {
      key: 'open',
      label: '',
      render: (row) => (
        <Button type="button" size="sm" variant="outline" onClick={() => router.push(`/dashboard/loyalty/campaigns/${row.id}`)}>
          Open
        </Button>
      ),
    },
  ];

  return (
    <Section label="Campaigns">
      <div className="flex justify-end">
        <Button type="button" onClick={() => setCreating(true)} disabled={!branchId}>
          New Campaign
        </Button>
      </div>
      {!branchId ? (
        <p className="text-small text-secondary">Choose a property first — a campaign is sent from one property.</p>
      ) : campaigns.isError ? (
        <p className="text-small text-red-600">{errorText(campaigns.error, 'Couldn’t load campaigns.')}</p>
      ) : (
        <Table columns={columns} rows={campaigns.data ?? []} emptyMessage={campaigns.isLoading ? 'Loading…' : 'No campaigns yet.'} />
      )}
      {creating && branchId ? <NewCampaignModal auth={auth} branchId={branchId} onClose={() => setCreating(false)} /> : null}
    </Section>
  );
}

function NewCampaignModal({ auth, branchId, onClose }: { auth: AuthOpts; branchId: string; onClose: () => void }) {
  const router = useRouter();
  const segments = useSegmentsQuery(auth);
  const templates = useTemplatesQuery(auth);
  const create = useCreateCampaignMutation(branchId, auth);

  const [name, setName] = useState('');
  const [segmentId, setSegmentId] = useState<string | null>(null);
  const [templateId, setTemplateId] = useState<string | null>(null);
  const [subject, setSubject] = useState('');
  const [abTest, setAbTest] = useState(false);
  const [variantTemplateId, setVariantTemplateId] = useState<string | null>(null);
  const [shareOnA, setShareOnA] = useState('50');
  const [schedule, setSchedule] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const segmentOptions = (segments.data ?? []).map((s) => ({ value: s.id, label: s.name }));
  const templateOptions = (templates.data ?? []).map((t) => ({ value: t.id, label: t.name }));
  const chosenTemplate = templates.data?.find((t) => t.id === templateId);
  const share = Number(shareOnA);
  const shareValid = Number.isInteger(share) && share >= 5 && share <= 95;

  const canSave =
    name.trim().length >= 2 &&
    segmentId !== null &&
    templateId !== null &&
    (!abTest || (variantTemplateId !== null && variantTemplateId !== templateId && shareValid)) &&
    (!schedule || scheduledAt !== '');

  function save() {
    if (!canSave || !segmentId || !templateId) return;
    setError(null);
    create.mutate(
      {
        name: name.trim(),
        channel: 'email',
        segmentId,
        templateId,
        subject: subject.trim() || undefined,
        // datetime-local is the viewer's own clock; toISOString pins it to an instant.
        scheduledAt: schedule ? new Date(scheduledAt).toISOString() : undefined,
        abTest: abTest && variantTemplateId ? { variantTemplateId, splitRatio: share / 100 } : undefined,
      },
      {
        onSuccess: (campaign) => router.push(`/dashboard/loyalty/campaigns/${campaign.id}`),
        onError: (err) => setError(errorText(err, 'Couldn’t create the campaign.')),
      },
    );
  }

  const missing = segmentOptions.length === 0 || templateOptions.length === 0;

  return (
    <Modal open onClose={onClose} title="New Campaign">
      <div className="flex flex-col gap-3">
        {missing ? (
          <p className="text-small text-amber-700">
            A campaign needs {segmentOptions.length === 0 ? 'an audience' : ''}
            {segmentOptions.length === 0 && templateOptions.length === 0 ? ' and ' : ''}
            {templateOptions.length === 0 ? 'a template' : ''} — create {segmentOptions.length + templateOptions.length === 0 ? 'them' : 'it'} below first.
          </p>
        ) : null}
        <Input id="campaign-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={160} placeholder="March win-back" />
        <Select id="campaign-segment" label="Audience" options={segmentOptions} value={segmentId} onChange={setSegmentId} placeholder="Choose an audience" />
        <Select id="campaign-template" label="Template" options={templateOptions} value={templateId} onChange={setTemplateId} placeholder="Choose a template" />
        <Input
          id="campaign-subject"
          label="Subject (optional)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={500}
          placeholder={chosenTemplate?.subject ?? 'Uses the template’s subject'}
          hint="Leave blank to use the template’s own subject."
        />

        <label className="flex items-center gap-2 text-small text-secondary cursor-pointer">
          <input id="campaign-ab" type="checkbox" checked={abTest} onChange={(e) => setAbTest(e.target.checked)} className="size-4 accent-secondary" />
          A/B test — send a second template to part of the audience and compare
        </label>
        {abTest ? (
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_9rem] gap-3 pl-6">
            <Select
              id="campaign-variant"
              label="Variant B template"
              options={templateOptions.filter((option) => option.value !== templateId)}
              value={variantTemplateId}
              onChange={setVariantTemplateId}
              placeholder="Choose variant B"
            />
            <Input
              id="campaign-split"
              label="Share on A (%)"
              type="number"
              min={5}
              max={95}
              value={shareOnA}
              onChange={(e) => setShareOnA(e.target.value)}
              error={shareOnA && !shareValid ? '5 to 95' : undefined}
            />
          </div>
        ) : null}

        <label className="flex items-center gap-2 text-small text-secondary cursor-pointer">
          <input id="campaign-schedule" type="checkbox" checked={schedule} onChange={(e) => setSchedule(e.target.checked)} className="size-4 accent-secondary" />
          Schedule it — otherwise it stays a draft until you send it
        </label>
        {schedule ? (
          <div className="pl-6 max-w-xs">
            <Input id="campaign-scheduled-at" label="Send at" type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} hint="Your computer’s local time." />
          </div>
        ) : null}

        {error ? <p className="text-small text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={save} loading={create.isPending} disabled={!canSave}>
            Create Campaign
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Audiences
// ---------------------------------------------------------------------------

function SegmentsSection({ auth }: { auth: AuthOpts }) {
  const segments = useSegmentsQuery(auth);
  const remove = useDeleteSegmentMutation(auth);
  const [editing, setEditing] = useState<Segment | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Section label="Audiences">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-small text-secondary max-w-2xl">
          Rules are checked against live guest data every time an audience is used. Only guests who opted in and have an email address are ever sent anything.
        </p>
        <Button type="button" variant="outline" onClick={() => setEditing('new')}>
          New Audience
        </Button>
      </div>
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {segments.data?.length === 0 ? <p className="text-small text-secondary">No audiences yet.</p> : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(segments.data ?? []).map((segment) => (
          <Card key={segment.id} className="flex flex-col gap-2">
            <p className="text-body font-semibold text-secondary">{segment.name}</p>
            {segment.description ? <p className="text-small text-secondary/80">{segment.description}</p> : null}
            <ul className="list-disc pl-5 text-small text-secondary">
              {segment.rules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(segment)}>
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setError(null);
                  remove.mutate(segment.id, { onError: (err) => setError(errorText(err, 'Couldn’t remove that audience.')) });
                }}
              >
                Remove
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {editing ? <SegmentModal auth={auth} segment={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </Section>
  );
}

const VIP_OPTIONS = [
  { value: '', label: 'Any' },
  ...[1, 2, 3, 4, 5].map((level) => ({ value: String(level), label: `${level} or above` })),
];

function numberOrUndefined(value: string): number | undefined {
  if (value.trim() === '') return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function SegmentModal({ auth, segment, onClose }: { auth: AuthOpts; segment: Segment | null; onClose: () => void }) {
  const save = useSaveSegmentMutation(auth);
  const preview = usePreviewSegmentMutation(auth);
  const program = useLoyaltyProgramQuery(auth);
  const initial = segment?.criteria ?? {};

  const [name, setName] = useState(segment?.name ?? '');
  const [description, setDescription] = useState(segment?.description ?? '');
  const [minStays, setMinStays] = useState(initial.minStays?.toString() ?? '');
  const [lastStayWithinDays, setLastStayWithinDays] = useState(initial.lastStayWithinDays?.toString() ?? '');
  const [notStayedForDays, setNotStayedForDays] = useState(initial.notStayedForDays?.toString() ?? '');
  const [minTotalSpend, setMinTotalSpend] = useState(initial.minTotalSpend?.toString() ?? '');
  const [vipLevelMin, setVipLevelMin] = useState(initial.vipLevelMin?.toString() ?? '');
  const [loyaltyTiers, setLoyaltyTiers] = useState<string[]>(initial.loyaltyTiers ?? []);
  const [tags, setTags] = useState<string[]>(initial.tags ?? []);
  const [nationalities, setNationalities] = useState<string[]>(initial.nationalities ?? []);
  const [result, setResult] = useState<SegmentPreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  function criteria(): SegmentCriteria {
    const built: SegmentCriteria = {
      minStays: numberOrUndefined(minStays),
      lastStayWithinDays: numberOrUndefined(lastStayWithinDays),
      notStayedForDays: numberOrUndefined(notStayedForDays),
      minTotalSpend: numberOrUndefined(minTotalSpend),
      vipLevelMin: numberOrUndefined(vipLevelMin),
      loyaltyTiers: loyaltyTiers.length ? loyaltyTiers : undefined,
      tags: tags.length ? tags : undefined,
      nationalities: nationalities.length ? nationalities : undefined,
      // Kept as saved: the builder doesn't edit property filters, but must not drop one either.
      branchIds: initial.branchIds,
    };
    return Object.fromEntries(Object.entries(built).filter(([, value]) => value !== undefined)) as SegmentCriteria;
  }

  function check() {
    setError(null);
    preview.mutate(criteria(), { onSuccess: setResult, onError: (err) => setError(errorText(err, 'Couldn’t check that audience.')) });
  }

  function submit() {
    setError(null);
    save.mutate(
      { id: segment?.id, name: name.trim(), description: description.trim() || undefined, criteria: criteria() },
      { onSuccess: onClose, onError: (err) => setError(errorText(err, 'Couldn’t save the audience.')) },
    );
  }

  const tierOptions = (program.data?.tiers ?? []).map((tier) => ({ value: tier.name, label: tier.name }));

  return (
    <Modal open onClose={onClose} title={segment ? 'Edit Audience' : 'New Audience'}>
      <div className="flex flex-col gap-3">
        <Input id="segment-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Lapsed guests — no stay in 6 months" />
        <Input id="segment-description" label="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />

        <p className="text-small font-semibold text-secondary pt-1">Stays and spend</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          <Input id="segment-min-stays" label="Completed stays, at least" type="number" min={0} value={minStays} onChange={(e) => setMinStays(e.target.value)} />
          <Input id="segment-min-spend" label="Has spent at least" type="number" min={0} value={minTotalSpend} onChange={(e) => setMinTotalSpend(e.target.value)} hint="Payments across all their bills." />
          <Input id="segment-recent" label="Stayed in the last (days)" type="number" min={0} value={lastStayWithinDays} onChange={(e) => setLastStayWithinDays(e.target.value)} />
          <Input
            id="segment-lapsed"
            label="Hasn’t stayed in (days)"
            type="number"
            min={0}
            value={notStayedForDays}
            onChange={(e) => setNotStayedForDays(e.target.value)}
            hint="Includes guests who never stayed."
          />
        </div>

        <p className="text-small font-semibold text-secondary pt-1">Guest</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
          <Select id="segment-vip" label="VIP level" options={VIP_OPTIONS} value={vipLevelMin} onChange={setVipLevelMin} />
          <MultiSelectTagInput id="segment-tiers" label="Loyalty tier (any of)" options={tierOptions} value={loyaltyTiers} onChange={setLoyaltyTiers} />
          <MultiSelectTagInput id="segment-tags" label="Tagged (any of)" options={[]} value={tags} onChange={setTags} allowCustom />
          <MultiSelectTagInput
            id="segment-nationalities"
            label="Nationality (any of)"
            options={[]}
            value={nationalities}
            onChange={setNationalities}
            allowCustom
            formatTag={(raw) => raw.trim().toUpperCase().slice(0, 2)}
            hint="Two-letter country codes, e.g. NG."
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-secondary/20 pt-3">
          <Button type="button" size="sm" variant="outline" onClick={check} loading={preview.isPending}>
            Check Audience
          </Button>
          {result ? (
            <p className="text-small text-secondary" id="segment-preview-result">
              {result.tooLarge ? (
                `${result.matching.toLocaleString()} guests match — too many to check. Add a rule to narrow it.`
              ) : (
                <>
                  <span className="font-semibold">{result.matching.toLocaleString()}</span> {result.matching === 1 ? 'guest matches' : 'guests match'};{' '}
                  <span className="font-semibold">{result.reachable.toLocaleString()}</span> can be emailed (opted in, with an address).
                </>
              )}
            </p>
          ) : null}
        </div>
        {result && result.sample.length > 0 ? (
          <ul className="text-small text-secondary/80 pl-5 list-disc">
            {result.sample.map((guest) => (
              <li key={guest.id}>
                {guest.name} {guest.email ? `— ${guest.email}` : ''}
              </li>
            ))}
          </ul>
        ) : null}

        {error ? <p className="text-small text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} loading={save.isPending} disabled={name.trim().length < 2}>
            Save Audience
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Templates
// ---------------------------------------------------------------------------

function TemplatesSection({ auth }: { auth: AuthOpts }) {
  const templates = useTemplatesQuery(auth);
  const remove = useDeleteTemplateMutation(auth);
  const [editing, setEditing] = useState<MessageTemplate | 'new' | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Section label="Templates">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-small text-secondary max-w-2xl">Write the message as plain text. Links are tracked and an unsubscribe link is always added.</p>
        <Button type="button" variant="outline" onClick={() => setEditing('new')}>
          New Template
        </Button>
      </div>
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {templates.data?.length === 0 ? <p className="text-small text-secondary">No templates yet.</p> : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {(templates.data ?? []).map((template) => (
          <Card key={template.id} className="flex flex-col gap-2">
            <p className="text-body font-semibold text-secondary">{template.name}</p>
            {template.subject ? <p className="text-small text-secondary">Subject: {template.subject}</p> : null}
            <p className="text-small text-secondary/80 line-clamp-3 whitespace-pre-wrap">{template.body}</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(template)}>
                Edit
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setError(null);
                  remove.mutate(template.id, { onError: (err) => setError(errorText(err, 'Couldn’t remove that template.')) });
                }}
              >
                Remove
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {editing ? <TemplateModal auth={auth} template={editing === 'new' ? null : editing} onClose={() => setEditing(null)} /> : null}
    </Section>
  );
}

function TemplateModal({ auth, template, onClose }: { auth: AuthOpts; template: MessageTemplate | null; onClose: () => void }) {
  const save = useSaveTemplateMutation(auth);
  const preview = usePreviewTemplateMutation(auth);
  const mergeFields = useMergeFieldsQuery(auth);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const [name, setName] = useState(template?.name ?? '');
  const [subject, setSubject] = useState(template?.subject ?? '');
  const [body, setBody] = useState(template?.body ?? '');
  const [error, setError] = useState<string | null>(null);

  /** Drops the placeholder where the cursor is, not at the end — that's where someone clicking a field chip means it to go. */
  function insertField(token: string) {
    const field = `{{${token}}}`;
    const el = bodyRef.current;
    if (!el) {
      setBody((current) => current + field);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    setBody(body.slice(0, start) + field + body.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + field.length, start + field.length);
    });
  }

  function showPreview() {
    setError(null);
    preview.mutate({ body, subject: subject || undefined }, { onError: (err) => setError(errorText(err, 'Couldn’t preview that.')) });
  }

  function submit() {
    setError(null);
    save.mutate(
      { id: template?.id, name: name.trim(), subject: subject.trim() || undefined, body },
      { onSuccess: onClose, onError: (err) => setError(errorText(err, 'Couldn’t save the template.')) },
    );
  }

  return (
    <Modal open onClose={onClose} title={template ? 'Edit Template' : 'New Template'}>
      <div className="flex flex-col gap-3">
        <Input id="template-name" label="Name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Come back — 15% off" />
        <Input id="template-subject" label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={500} placeholder="{{guest_first_name}}, your room is waiting" />
        <Textarea
          ref={bodyRef}
          id="template-body"
          label="Message"
          rows={9}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={'Hello {{guest_first_name}},\n\nIt’s been a while. Book direct at https://… and take 15% off.\n\n{{hotel_name}}'}
          hint="A blank line starts a new paragraph. Links are turned into tracked links automatically."
        />
        <div className="flex flex-wrap gap-2" aria-label="Insert a merge field">
          {(mergeFields.data ?? []).map((field) => (
            <button
              key={field.token}
              type="button"
              title={field.label}
              onClick={() => insertField(field.token)}
              className="rounded-full border border-secondary/30 px-2.5 py-0.5 text-tiny text-secondary hover:bg-secondary/10"
            >
              {`{{${field.token}}}`}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={showPreview} loading={preview.isPending} disabled={body.trim().length < 10}>
            Preview
          </Button>
        </div>
        {preview.data ? (
          <div className="flex flex-col gap-1">
            <p className="text-small text-secondary">
              <span className="font-semibold">Subject:</span> {preview.data.subject || '(none — the campaign name is used)'}
            </p>
            {/* A sandboxed frame with no permissions at all: it renders the real HTML part, and nothing in it can run. */}
            <iframe title="Email preview" sandbox="" srcDoc={preview.data.html} className="w-full h-80 rounded-control border border-secondary/20 bg-white" />
          </div>
        ) : null}

        {error ? <p className="text-small text-red-600">{error}</p> : null}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} loading={save.isPending} disabled={name.trim().length < 2 || body.trim().length < 10}>
            Save Template
          </Button>
        </div>
      </div>
    </Modal>
  );
}
