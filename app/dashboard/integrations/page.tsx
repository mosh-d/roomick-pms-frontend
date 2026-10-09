'use client';

import { useMemo, useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { CopyButton } from '@/components/ui/CopyButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { IntegrationsIcon, PaymentGatewayIcon } from '@/components/ui/Icons';
import { HubCard } from '../_components/HubCard';
import {
  useApiKeyScopesQuery,
  useApiKeysQuery,
  useCreateApiKeyMutation,
  useUpdateApiKeyMutation,
  useRevokeApiKeyMutation,
  useWebhookEventsQuery,
  useWebhooksQuery,
  useCreateWebhookMutation,
  useUpdateWebhookMutation,
  useTestWebhookMutation,
  useWebhookDeliveriesQuery,
  useRetryDeliveryMutation,
  type ApiKeyScope,
  type ApiKeySummary,
  type WebhookDelivery,
  type WebhookEvent,
  type WebhookSummary,
} from '@/lib/integrations';
import { API_BASE_URL, ApiError } from '@/lib/api';
import { useMyBranches } from '@/lib/dashboardBranches';
import { useAuthStore } from '@/lib/store/authStore';
import { formatMoment } from '@/lib/dates';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/** The branch picker's "no branch" choice — a key or webhook for the whole account. */
const EVERY_BRANCH = 'all';

const errorText = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
const when = (iso: string | null) => (iso ? formatMoment(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

/** Shown once, straight after creating a key or a webhook — the only time its secret is readable. */
function ShownOnce({ title, value, onDone }: { title: string; value: string; onDone: () => void }) {
  return (
    <Card tone="accent" className="flex flex-col gap-2 border-2">
      <p className="text-small font-semibold text-surface">{title}</p>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-control border border-primary/30 surface-page bg-white px-3 py-2 text-tiny text-surface break-all">{value}</code>
        <CopyButton value={value} />
      </div>
      <Button type="button" size="sm" variant="outline" onClick={onDone} className="self-start">
        Done
      </Button>
    </Card>
  );
}

/** Tick boxes with a line under each saying what it covers. */
function Checklist({ legend, items, value, onChange }: { legend: string; items: Array<{ key: string; label: string; description: string }>; value: string[]; onChange: (next: string[]) => void }) {
  const toggle = (key: string) => onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-small font-semibold text-surface mb-1">{legend}</legend>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        {items.map((item) => (
          <label key={item.key} className="flex items-start gap-2 cursor-pointer">
            <input type="checkbox" className="size-4 mt-0.5 accent-primary cursor-pointer shrink-0" checked={value.includes(item.key)} onChange={() => toggle(item.key)} />
            <span className="flex flex-col">
              <span className="text-small font-semibold text-surface">{item.label}</span>
              <span className="text-tiny text-surface-muted">{item.description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * Integrations & APIs (ref p23). API keys let another system read from
 * Roomick; webhooks tell it the moment something happens here. Payment
 * Gateway stays an inert card until a payment processor is connected — a
 * form storing credentials nothing reads would mislead.
 */
export default function IntegrationsPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };
  const branchesQuery = useMyBranches(user, auth);
  const branchOptions: SelectOption[] = useMemo(
    () => [{ value: EVERY_BRANCH, label: 'Every branch' }, ...(branchesQuery.data ?? []).map((branch) => ({ value: branch.id, label: branch.name }))],
    [branchesQuery.data],
  );

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader title="Integrations & APIs" subtitle="Payment gateways, smart locks, webhooks, partner APIs, OTA integrations." roles="Owner" />

      <Section label="Integrations">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <HubCard icon={<PaymentGatewayIcon className="size-5" />} title="Payment Gateway" description="Stripe / Adyen / Authorize.net config" />
          <HubCard
            icon={<IntegrationsIcon className="size-5" />}
            title="Integrations Marketplace"
            description="Browse by category and switch on accounting exports, review requests and more"
            href="/dashboard/integrations/marketplace"
          />
        </div>
      </Section>

      <ApiKeysSection auth={auth} branchOptions={branchOptions} tenantId={user?.tenantId ?? ''} />
      <WebhooksSection auth={auth} branchOptions={branchOptions} />
    </Container>
  );
}

// --- API keys -----------------------------------------------------------------------------------------------------

function ApiKeysSection({ auth, branchOptions, tenantId }: { auth: AuthOpts; branchOptions: SelectOption[]; tenantId: string }) {
  const scopesQuery = useApiKeyScopesQuery(auth);
  const keysQuery = useApiKeysQuery(auth);
  const createMutation = useCreateApiKeyMutation(auth);
  const revokeMutation = useRevokeApiKeyMutation(auth);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [branch, setBranch] = useState(EVERY_BRANCH);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<{ name: string; rawKey: string } | null>(null);
  const [editing, setEditing] = useState<ApiKeySummary | null>(null);
  const [revoking, setRevoking] = useState<ApiKeySummary | null>(null);

  const scopeList = scopesQuery.data ?? [];
  const labelOf = (key: string) => scopeList.find((scope) => scope.key === key)?.label ?? key;

  async function create() {
    if (!name.trim() || scopes.length === 0) return;
    setError(null);
    try {
      const created = await createMutation.mutateAsync({ name: name.trim(), scopes, ...(branch !== EVERY_BRANCH ? { branchId: branch } : {}) });
      setJustCreated({ name: created.name, rawKey: created.rawKey });
      setName('');
      setScopes([]);
      setBranch(EVERY_BRANCH);
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <Section label="API Keys">
      <p className="text-small text-surface-muted max-w-3xl">
        Let another system — a reporting tool, an accounting package, a CRM — read from Roomick. A key only reads, and only what you tick. It never reaches
        staff, security settings, backups or ID document numbers, and it stops working the moment you revoke it.
      </p>
      <HowToCallTheApi tenantId={tenantId} />

      {justCreated ? (
        <ShownOnce title={`“${justCreated.name}” is ready — copy the key now. It won’t be shown again.`} value={justCreated.rawKey} onDone={() => setJustCreated(null)} />
      ) : (
        <Card tone="secondary" className="flex flex-col gap-4">
          <p className="text-body font-semibold text-surface">New key</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 max-w-3xl">
            <Input id="new-api-key-name" label="Key Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Accounting sync" />
            <Select id="new-api-key-branch" label="Branch" options={branchOptions} value={branch} onChange={setBranch} />
          </div>
          <Checklist legend="Can read" items={scopeList} value={scopes} onChange={setScopes} />
          {error ? <p className="text-small text-red-600">{error}</p> : null}
          <Button type="button" onClick={create} loading={createMutation.isPending} disabled={!name.trim() || scopes.length === 0} className="self-start">
            Generate Key
          </Button>
        </Card>
      )}

      {keysQuery.isLoading ? null : (keysQuery.data ?? []).length === 0 ? (
        <p className="text-body text-surface-muted">No API keys yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {(keysQuery.data ?? []).map((key) => (
            <Card key={key.id} tone="secondary" className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex flex-col gap-1 min-w-0">
                <p className="text-body font-semibold text-surface">
                  {key.name} <span className="font-mono text-small text-surface-muted">{key.keyPrefix}…</span>
                </p>
                <p className="text-small text-surface">
                  {key.revokedAt ? 'Revoked' : key.scopes.length === 0 ? 'Can’t read anything yet — edit it to give it access' : `Reads ${key.scopes.map(labelOf).join(', ')}`}
                  {' · '}
                  {key.branch ? key.branch.name : 'Every branch'}
                </p>
                <p className="text-tiny text-surface-muted">
                  Made {when(key.createdAt)} · Last used {key.lastUsedAt ? when(key.lastUsedAt) : 'never'}
                  {key.revokedAt ? ` · Revoked ${when(key.revokedAt)}` : ''}
                </p>
              </div>
              {!key.revokedAt ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(key)}>
                    Edit Access
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setRevoking(key)}>
                    Revoke
                  </Button>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      {editing ? <EditApiKeyDialog key={editing.id} apiKey={editing} scopes={scopeList} branchOptions={branchOptions} auth={auth} onClose={() => setEditing(null)} /> : null}
      <ConfirmDialog
        open={revoking !== null}
        title="Revoke this key?"
        description={`“${revoking?.name ?? ''}” stops working at once. Anything still using it gets refused, and it can’t be switched back on — you’d make a new key.`}
        confirmLabel="Revoke"
        onCancel={() => setRevoking(null)}
        loading={revokeMutation.isPending}
        onConfirm={() => {
          if (revoking) revokeMutation.mutate(revoking.id, { onSettled: () => setRevoking(null) });
        }}
      />
    </Section>
  );
}

function EditApiKeyDialog({
  apiKey,
  scopes,
  branchOptions,
  auth,
  onClose,
}: {
  apiKey: ApiKeySummary;
  scopes: ApiKeyScope[];
  branchOptions: SelectOption[];
  auth: AuthOpts;
  onClose: () => void;
}) {
  const updateMutation = useUpdateApiKeyMutation(auth);
  const [name, setName] = useState(apiKey.name);
  const [selected, setSelected] = useState<string[]>(apiKey.scopes);
  const [branch, setBranch] = useState(apiKey.branch?.id ?? EVERY_BRANCH);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    try {
      await updateMutation.mutateAsync({ keyId: apiKey.id, name: name.trim(), scopes: selected, branchId: branch === EVERY_BRANCH ? null : branch });
      onClose();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <Modal open onClose={onClose} title={`Edit ${apiKey.name}`}>
      <p className="text-small text-surface-muted">The key itself stays the same, so nothing using it needs changing — it just reads what you tick from now on.</p>
      <Input id="edit-api-key-name" label="Key Name" value={name} onChange={(e) => setName(e.target.value)} />
      <Select id="edit-api-key-branch" label="Branch" options={branchOptions} value={branch} onChange={setBranch} />
      <Checklist legend="Can read" items={scopes} value={selected} onChange={setSelected} />
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="flex gap-3">
        <Button type="button" onClick={save} loading={updateMutation.isPending} disabled={!name.trim() || selected.length === 0}>
          Save
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

function HowToCallTheApi({ tenantId }: { tenantId: string }) {
  const [open, setOpen] = useState(false);
  const docsUrl = `${API_BASE_URL.replace(/\/api\/v1\/?$/, '')}/api/docs`;
  const example = `curl ${API_BASE_URL}/branches \\\n  -H "Authorization: Bearer rk_your_key" \\\n  -H "X-Tenant-ID: ${tenantId}"`;
  return (
    <Card tone="secondary" className="flex flex-col gap-3">
      <button type="button" className="flex items-center justify-between text-left text-body font-semibold text-surface cursor-pointer" aria-expanded={open} onClick={() => setOpen(!open)}>
        How another system calls the API
        <span className="text-small font-normal text-surface-muted">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? (
        <div className="flex flex-col gap-3 text-small text-surface">
          <p>Every request carries the key and your account ID. Hand both to whoever sets up the other system — the key is a password, so send it privately.</p>
          <dl className="grid grid-cols-1 sm:grid-cols-[10rem_1fr] gap-x-4 gap-y-2">
            <dt className="font-semibold">API address</dt>
            <dd className="font-mono break-all">{API_BASE_URL}</dd>
            <dt className="font-semibold">Account ID</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <span className="font-mono break-all">{tenantId}</span>
              <CopyButton value={tenantId} label="Copy ID" />
            </dd>
            <dt className="font-semibold">Headers</dt>
            <dd className="font-mono break-all">
              Authorization: Bearer rk_…<br />
              X-Tenant-ID: {tenantId}
            </dd>
          </dl>
          <pre className="rounded-control border border-secondary/20 surface-page bg-white px-3 py-2 text-tiny text-surface overflow-x-auto">{example}</pre>
          <p className="text-surface-muted">
            A key can only make GET requests. Asking for something it wasn’t given access to — or for another branch than the one it’s kept to — gets a 403. Every
            route, with what it returns, is listed in the{' '}
            <a href={docsUrl} target="_blank" rel="noreferrer" className="underline font-semibold text-surface">
              API reference
            </a>
            .
          </p>
        </div>
      ) : null}
    </Card>
  );
}

// --- Webhooks -----------------------------------------------------------------------------------------------------

function WebhooksSection({ auth, branchOptions }: { auth: AuthOpts; branchOptions: SelectOption[] }) {
  const eventsQuery = useWebhookEventsQuery(auth);
  const webhooksQuery = useWebhooksQuery(auth);
  const createMutation = useCreateWebhookMutation(auth);
  const [url, setUrl] = useState('');
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [branch, setBranch] = useState(EVERY_BRANCH);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<{ url: string; secret: string } | null>(null);

  const events = (eventsQuery.data ?? []).map((event) => ({ key: event.type, label: event.label, description: event.description }));

  async function create() {
    if (!url.trim() || eventTypes.length === 0) return;
    setError(null);
    try {
      const created = await createMutation.mutateAsync({ url: url.trim(), eventTypes, ...(branch !== EVERY_BRANCH ? { branchId: branch } : {}) });
      setJustCreated({ url: created.url, secret: created.secret });
      setUrl('');
      setEventTypes([]);
      setBranch(EVERY_BRANCH);
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <Section label="Webhooks">
      <p className="text-small text-surface-muted max-w-3xl">
        Tell another system the moment something happens here — a booking made, a guest checked in, a payment taken. Each delivery is signed so the receiver
        knows it came from Roomick, and one that doesn’t get through is tried again for about a day. Deliveries include the guest’s name, email and phone.
      </p>
      <CheckingTheSignature />

      {justCreated ? (
        <ShownOnce
          title={`Webhook for ${justCreated.url} is on — copy the signing secret now. It won’t be shown again.`}
          value={justCreated.secret}
          onDone={() => setJustCreated(null)}
        />
      ) : (
        <Card tone="secondary" className="flex flex-col gap-4">
          <p className="text-body font-semibold text-surface">New webhook</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 max-w-3xl">
            <Input id="new-webhook-url" label="Endpoint URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://partner.example.com/webhooks/roomick" />
            <Select id="new-webhook-branch" label="Branch" options={branchOptions} value={branch} onChange={setBranch} />
          </div>
          <Checklist legend="Send when" items={events} value={eventTypes} onChange={setEventTypes} />
          {error ? <p className="text-small text-red-600">{error}</p> : null}
          <Button type="button" onClick={create} loading={createMutation.isPending} disabled={!url.trim() || eventTypes.length === 0} className="self-start">
            Add Webhook
          </Button>
        </Card>
      )}

      {webhooksQuery.isLoading ? null : (webhooksQuery.data ?? []).length === 0 ? (
        <p className="text-body text-surface-muted">No webhooks yet.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {(webhooksQuery.data ?? []).map((webhook) => (
            <WebhookCard key={webhook.id} webhook={webhook} events={eventsQuery.data ?? []} branchOptions={branchOptions} auth={auth} />
          ))}
        </div>
      )}
    </Section>
  );
}

function WebhookCard({ webhook, events, branchOptions, auth }: { webhook: WebhookSummary; events: WebhookEvent[]; branchOptions: SelectOption[]; auth: AuthOpts }) {
  const updateMutation = useUpdateWebhookMutation(auth);
  const testMutation = useTestWebhookMutation(auth);
  const [showDeliveries, setShowDeliveries] = useState(false);
  const [editing, setEditing] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const labelOf = (type: string) => events.find((event) => event.type === type)?.label ?? type;

  async function sendTest() {
    setTestResult(null);
    setError(null);
    try {
      const result = await testMutation.mutateAsync(webhook.id);
      setTestResult(result.status === 'delivered' ? `Test delivered — your endpoint answered ${result.responseStatus}.` : `Test didn’t get through: ${result.lastError ?? 'no answer'}.`);
    } catch (err) {
      setError(errorText(err));
    }
  }

  async function setActive(isActive: boolean) {
    setError(null);
    try {
      await updateMutation.mutateAsync({ webhookId: webhook.id, isActive });
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <Card tone="accent" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1 min-w-0">
          <p className="text-body font-semibold text-surface break-all">{webhook.url}</p>
          <p className="text-small text-surface">
            {webhook.eventTypes.length > 0 ? webhook.eventTypes.map(labelOf).join(', ') : 'No events'} · {webhook.branch ? webhook.branch.name : 'Every branch'}
          </p>
          <p className="text-tiny text-surface-muted">
            {webhook.isActive ? 'On' : 'Off'}
            {webhook.lastDeliveredAt ? ` · Last delivered ${when(webhook.lastDeliveredAt)}` : ' · Nothing delivered yet'}
            {webhook.pending > 0 ? ` · ${webhook.pending} waiting` : ''}
            {webhook.failedThisWeek > 0 ? ` · ${webhook.failedThisWeek} failed this week` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {webhook.isActive ? (
            <Button size="sm" variant="outline" loading={testMutation.isPending} onClick={sendTest}>
              Send Test
            </Button>
          ) : null}
          <Button size="sm" variant="outline" onClick={() => setShowDeliveries(!showDeliveries)} aria-expanded={showDeliveries}>
            {showDeliveries ? 'Hide Deliveries' : 'Deliveries'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
            Edit
          </Button>
          <Button size="sm" variant="outline" loading={updateMutation.isPending} onClick={() => setActive(!webhook.isActive)}>
            {webhook.isActive ? 'Switch Off' : 'Switch On'}
          </Button>
        </div>
      </div>
      {testResult ? <p className="text-small font-semibold text-surface">{testResult}</p> : null}
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      {showDeliveries ? <DeliveryLog webhookId={webhook.id} events={events} auth={auth} /> : null}
      {editing ? <EditWebhookDialog webhook={webhook} events={events} branchOptions={branchOptions} auth={auth} onClose={() => setEditing(false)} /> : null}
    </Card>
  );
}

function deliveryStatusText(delivery: WebhookDelivery): string {
  if (delivery.status === 'delivered') return `Delivered ${when(delivery.deliveredAt)}`;
  if (delivery.status === 'failed') return 'Gave up';
  return delivery.attempts === 0 ? 'Waiting to send' : `Trying again ${when(delivery.nextAttemptAt)}`;
}

function DeliveryLog({ webhookId, events, auth }: { webhookId: string; events: WebhookEvent[]; auth: AuthOpts }) {
  const deliveriesQuery = useWebhookDeliveriesQuery(webhookId, auth);
  const retryMutation = useRetryDeliveryMutation(webhookId, auth);
  const [error, setError] = useState<string | null>(null);
  const labelOf = (type: string) => (type === 'webhook.test' ? 'Test' : (events.find((event) => event.type === type)?.label ?? type));
  const deliveries = deliveriesQuery.data ?? [];

  async function retry(deliveryId: string) {
    setError(null);
    try {
      await retryMutation.mutateAsync(deliveryId);
    } catch (err) {
      setError(errorText(err));
    }
  }

  if (deliveriesQuery.isLoading) return null;
  if (deliveries.length === 0) return <p className="text-small text-surface-muted">Nothing sent yet. Send a test to check the endpoint.</p>;
  return (
    <div className="flex flex-col gap-2">
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse" aria-label="Deliveries">
          <thead>
            <tr className="text-small font-bold text-surface text-left">
              <th className="py-2 pr-4">Event</th>
              <th className="py-2 pr-4">Queued</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Tries</th>
              <th className="py-2 pr-4">Answer</th>
              <th className="py-2 pr-4">Action</th>
            </tr>
          </thead>
          <tbody>
            {deliveries.map((delivery) => (
              <tr key={delivery.id} className="border-t border-accent-dark/20 text-small text-surface align-top">
                <td className="py-2 pr-4">{labelOf(delivery.eventType)}</td>
                <td className="py-2 pr-4 whitespace-nowrap">{when(delivery.createdAt)}</td>
                <td className="py-2 pr-4">{deliveryStatusText(delivery)}</td>
                <td className="py-2 pr-4">{delivery.attempts}</td>
                <td className="py-2 pr-4 break-words max-w-xs">{delivery.lastError ?? (delivery.responseStatus ? `HTTP ${delivery.responseStatus}` : '—')}</td>
                <td className="py-2 pr-4">
                  {delivery.status !== 'delivered' ? (
                    <Button size="sm" variant="outline" loading={retryMutation.isPending && retryMutation.variables === delivery.id} onClick={() => retry(delivery.id)}>
                      Retry
                    </Button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EditWebhookDialog({
  webhook,
  events,
  branchOptions,
  auth,
  onClose,
}: {
  webhook: WebhookSummary;
  events: WebhookEvent[];
  branchOptions: SelectOption[];
  auth: AuthOpts;
  onClose: () => void;
}) {
  const updateMutation = useUpdateWebhookMutation(auth);
  const [url, setUrl] = useState(webhook.url);
  const [eventTypes, setEventTypes] = useState<string[]>(webhook.eventTypes);
  const [branch, setBranch] = useState(webhook.branch?.id ?? EVERY_BRANCH);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    try {
      await updateMutation.mutateAsync({ webhookId: webhook.id, url: url.trim(), eventTypes, branchId: branch === EVERY_BRANCH ? null : branch });
      onClose();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit webhook">
      <p className="text-small text-surface-muted">The signing secret stays the same.</p>
      <Input id="edit-webhook-url" label="Endpoint URL" value={url} onChange={(e) => setUrl(e.target.value)} />
      <Select id="edit-webhook-branch" label="Branch" options={branchOptions} value={branch} onChange={setBranch} />
      <Checklist legend="Send when" items={events.map((event) => ({ key: event.type, label: event.label, description: event.description }))} value={eventTypes} onChange={setEventTypes} />
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="flex gap-3">
        <Button type="button" onClick={save} loading={updateMutation.isPending} disabled={!url.trim() || eventTypes.length === 0}>
          Save
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Modal>
  );
}

const VERIFY_SNIPPET = `// Node.js — check a delivery came from Roomick before trusting it
const crypto = require('crypto');

function fromRoomick(rawBody, signatureHeader, secret) {
  const { t, v1 } = Object.fromEntries(signatureHeader.split(',').map((part) => part.split('=')));
  const expected = crypto.createHmac('sha256', secret).update(\`\${t}.\${rawBody}\`).digest('hex');
  const fresh = Math.abs(Date.now() / 1000 - Number(t)) < 300; // refuse replays older than 5 minutes
  return fresh && v1.length === expected.length && crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
}`;

function CheckingTheSignature() {
  const [open, setOpen] = useState(false);
  return (
    <Card tone="secondary" className="flex flex-col gap-3">
      <button type="button" className="flex items-center justify-between text-left text-body font-semibold text-surface cursor-pointer" aria-expanded={open} onClick={() => setOpen(!open)}>
        What a delivery looks like, and checking it’s genuine
        <span className="text-small font-normal text-surface-muted">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open ? (
        <div className="flex flex-col gap-3 text-small text-surface">
          <p>
            Each delivery is a POST of JSON — <span className="font-mono">id</span>, <span className="font-mono">type</span>, <span className="font-mono">createdAt</span>,{' '}
            <span className="font-mono">branchId</span> and <span className="font-mono">data</span> (the booking or payment as it stood). Any 2xx answer within 10 seconds
            counts as delivered; anything else is tried again after 1, 5 and 15 minutes, then 1, 3, 6 and 12 hours. A delivery can arrive twice — use{' '}
            <span className="font-mono">id</span> to ignore a repeat.
          </p>
          <p>
            The <span className="font-mono">Roomick-Signature</span> header reads <span className="font-mono">t=&lt;time&gt;,v1=&lt;signature&gt;</span>: the HMAC-SHA256,
            with the webhook’s secret, of the time, a full stop, and the body exactly as received.
          </p>
          <pre className="rounded-control border border-secondary/20 surface-page bg-white px-3 py-2 text-tiny text-surface overflow-x-auto">{VERIFY_SNIPPET}</pre>
        </div>
      ) : null}
    </Card>
  );
}
