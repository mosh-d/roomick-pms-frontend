'use client';

import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { MultiSelectTagInput } from '@/components/ui/MultiSelectTagInput';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { IntegrationsIcon, PaymentGatewayIcon } from '@/components/ui/Icons';
import { HubCard } from '../_components/HubCard';
import {
  useApiKeysQuery,
  useCreateApiKeyMutation,
  useRevokeApiKeyMutation,
  useWebhooksQuery,
  useCreateWebhookMutation,
  useDeactivateWebhookMutation,
} from '@/lib/integrations';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

const EVENT_TYPE_OPTIONS = [
  { value: 'reservations.post', label: 'reservations.post' },
  { value: 'reservations.patch', label: 'reservations.patch' },
  { value: 'folios.post', label: 'folios.post' },
  { value: 'payments.post', label: 'payments.post' },
];

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </Button>
  );
}

/**
 * Integrations & APIs (ref p23). Payment Gateway stays an honest inert
 * card — no real payment-processor integration exists anywhere in this app
 * to configure, and a form that stores gateway "credentials" nothing ever
 * reads would be actively misleading. API Keys and Webhooks are both real,
 * CRUD-complete, and honestly incomplete in the same specific way: see the
 * backend's own `IntegrationsService` header comment for why neither is
 * wired into any real auth/delivery path yet.
 */
export default function IntegrationsPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader title="Integrations & APIs" subtitle="Payment gateways, smart locks, webhooks, partner APIs, OTA integrations." roles="Admin · Developer" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HubCard icon={<PaymentGatewayIcon className="size-5" />} title="Payment Gateway" description="Stripe / Adyen / Authorize.net config" />
        <HubCard
          icon={<IntegrationsIcon className="size-5" />}
          title="Integrations Marketplace"
          description="Browse by category and switch on accounting exports, review requests and more"
          href="/dashboard/integrations/marketplace"
        />
      </div>

      <ApiKeysSection auth={auth} />
      <WebhooksSection auth={auth} />
    </Container>
  );
}

function ApiKeysSection({ auth }: { auth: AuthOpts }) {
  const keysQuery = useApiKeysQuery(auth);
  const createMutation = useCreateApiKeyMutation(auth);
  const revokeMutation = useRevokeApiKeyMutation(auth);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<{ name: string; rawKey: string } | null>(null);

  async function create() {
    if (!name.trim()) return;
    setError(null);
    try {
      const created = await createMutation.mutateAsync(name.trim());
      setJustCreated({ name: created.name, rawKey: created.rawKey });
      setName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Section label="API Keys">
      <p className="text-small text-primary-dark/70">
        Generate and manage partner API credentials. Not yet accepted by any endpoint as an alternative to signing in — generating a key records it for a
        future integration, it doesn&rsquo;t grant access on its own yet.
      </p>

      {justCreated ? (
        <Card tone="accent" className="flex flex-col gap-2 border-2">
          <p className="text-small font-semibold text-primary-dark">
            &ldquo;{justCreated.name}&rdquo; created — copy this key now. It won&rsquo;t be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-control border border-primary/30 bg-white px-3 py-2 text-tiny break-all">{justCreated.rawKey}</code>
            <CopyButton value={justCreated.rawKey} />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setJustCreated(null)} className="self-start">
            Done
          </Button>
        </Card>
      ) : (
        <div className="flex items-end gap-3 max-w-lg">
          <div className="flex-1">
            <Input id="new-api-key-name" label="Key Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Zapier Integration" />
          </div>
          <Button type="button" onClick={create} loading={createMutation.isPending} disabled={!name.trim()}>
            Generate Key
          </Button>
        </div>
      )}
      {error ? <p className="text-small text-red-600">{error}</p> : null}

      {keysQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading…</p>
      ) : (keysQuery.data ?? []).length === 0 ? (
        <p className="text-body text-primary-dark/70">No API keys yet.</p>
      ) : (
        <Card tone="secondary" className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-small font-bold text-secondary text-left">
                <th className="py-2 pr-4">Name</th>
                <th className="py-2 pr-4">Key</th>
                <th className="py-2 pr-4">Created</th>
                <th className="py-2 pr-4">Last Used</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Action</th>
              </tr>
            </thead>
            <tbody>
              {(keysQuery.data ?? []).map((key) => (
                <tr key={key.id} className="border-t border-secondary/10 text-small text-secondary">
                  <td className="py-2 pr-4">{key.name}</td>
                  <td className="py-2 pr-4 font-mono">{key.keyPrefix}…</td>
                  <td className="py-2 pr-4">{new Date(key.createdAt).toLocaleDateString()}</td>
                  <td className="py-2 pr-4">{key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Never'}</td>
                  <td className="py-2 pr-4">{key.revokedAt ? 'Revoked' : 'Active'}</td>
                  <td className="py-2 pr-4">
                    {!key.revokedAt ? (
                      <Button size="sm" variant="outline" loading={revokeMutation.isPending} onClick={() => revokeMutation.mutate(key.id)}>
                        Revoke
                      </Button>
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
    </Section>
  );
}

function WebhooksSection({ auth }: { auth: AuthOpts }) {
  const webhooksQuery = useWebhooksQuery(auth);
  const createMutation = useCreateWebhookMutation(auth);
  const deactivateMutation = useDeactivateWebhookMutation(auth);
  const [url, setUrl] = useState('');
  const [eventTypes, setEventTypes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<{ url: string; secret: string } | null>(null);

  async function create() {
    if (!url.trim() || eventTypes.length === 0) return;
    setError(null);
    try {
      const created = await createMutation.mutateAsync({ url: url.trim(), eventTypes });
      setJustCreated({ url: created.url, secret: created.secret });
      setUrl('');
      setEventTypes([]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Section label="Webhooks">
      <p className="text-small text-primary-dark/70">
        Subscribe external systems to PMS events. These subscriptions are stored but not yet triggered by real events — delivery isn&rsquo;t wired up in
        this pass.
      </p>

      {justCreated ? (
        <Card tone="accent" className="flex flex-col gap-2 border-2">
          <p className="text-small font-semibold text-primary-dark">Webhook for {justCreated.url} created — copy the signing secret now. It won&rsquo;t be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-control border border-primary/30 bg-white px-3 py-2 text-tiny break-all">{justCreated.secret}</code>
            <CopyButton value={justCreated.secret} />
          </div>
          <Button type="button" size="sm" variant="outline" onClick={() => setJustCreated(null)} className="self-start">
            Done
          </Button>
        </Card>
      ) : (
        <div className="flex flex-col gap-3 max-w-lg">
          <Input id="new-webhook-url" label="Endpoint URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://partner.example.com/webhooks/roomick" />
          <MultiSelectTagInput id="new-webhook-events" label="Event Types" options={EVENT_TYPE_OPTIONS} value={eventTypes} onChange={setEventTypes} allowCustom />
          <Button type="button" onClick={create} loading={createMutation.isPending} disabled={!url.trim() || eventTypes.length === 0} className="self-start">
            Add Webhook
          </Button>
        </div>
      )}
      {error ? <p className="text-small text-red-600">{error}</p> : null}

      {webhooksQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading…</p>
      ) : (webhooksQuery.data ?? []).length === 0 ? (
        <p className="text-body text-primary-dark/70">No webhooks yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {(webhooksQuery.data ?? []).map((webhook) => (
            <Card key={webhook.id} tone="accent" className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-body font-semibold text-primary-dark break-all">{webhook.url}</p>
                <p className="text-tiny text-primary-dark/60">
                  {webhook.eventTypes.join(', ')} · {webhook.isActive ? 'Active' : 'Deactivated'}
                </p>
              </div>
              {webhook.isActive ? (
                <Button size="sm" variant="outline" loading={deactivateMutation.isPending} onClick={() => deactivateMutation.mutate(webhook.id)}>
                  Deactivate
                </Button>
              ) : null}
            </Card>
          ))}
        </div>
      )}
    </Section>
  );
}
