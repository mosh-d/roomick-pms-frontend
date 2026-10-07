import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

type BranchRef = { id: string; name: string } | null;

/** Mirrors `ApiKeySummary`/`CreatedApiKey` (roomick-pms-backend/src/modules/integrations/integrations.service.ts). `rawKey` only ever appears on the create response — never kept client-side beyond that one render. */
export interface ApiKeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  /** Permission modules the key can read. */
  scopes: string[];
  branch: BranchRef;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface CreatedApiKey extends ApiKeySummary {
  rawKey: string;
}

/** What a key can be given to read — `GET /api-keys/scopes`. */
export interface ApiKeyScope {
  key: string;
  label: string;
  description: string;
}

const API_KEYS_KEY = ['api-keys'] as const;

export function useApiKeyScopesQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['api-key-scopes'] as const,
    queryFn: () => apiFetch<ApiKeyScope[]>('/api-keys/scopes', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
    staleTime: Infinity,
  });
}

export function useApiKeysQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: API_KEYS_KEY,
    queryFn: () => apiFetch<ApiKeySummary[]>('/api-keys', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
  });
}

export function useCreateApiKeyMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; scopes: string[]; branchId?: string }) => apiFetch<CreatedApiKey>('/api-keys', { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: API_KEYS_KEY }),
  });
}

export function useUpdateApiKeyMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ keyId, ...body }: { keyId: string; name?: string; scopes?: string[]; branchId?: string | null }) =>
      apiFetch<ApiKeySummary>(`/api-keys/${keyId}`, { method: 'PATCH', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: API_KEYS_KEY }),
  });
}

export function useRevokeApiKeyMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keyId: string) => apiFetch<ApiKeySummary>(`/api-keys/${keyId}`, { method: 'DELETE', accessToken, tenantId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: API_KEYS_KEY }),
  });
}

/** Mirrors `WebhookSummary`/`CreatedWebhook`. `secret` only ever appears on the create response. */
export interface WebhookSummary {
  id: string;
  url: string;
  eventTypes: string[];
  branch: BranchRef;
  isActive: boolean;
  createdAt: string;
  pending: number;
  failedThisWeek: number;
  lastDeliveredAt: string | null;
}

export interface CreatedWebhook extends WebhookSummary {
  secret: string;
}

/** An event a webhook can listen for — `GET /webhooks/events`. */
export interface WebhookEvent {
  type: string;
  label: string;
  description: string;
}

export type DeliveryStatus = 'pending' | 'delivered' | 'failed';

/** Mirrors `DeliveryView` (webhook-dispatcher.service.ts). */
export interface WebhookDelivery {
  id: string;
  eventId: string;
  eventType: string;
  status: DeliveryStatus;
  attempts: number;
  responseStatus: number | null;
  lastError: string | null;
  /** When it's tried again — only while it's still pending. */
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

const WEBHOOKS_KEY = ['webhooks'] as const;
const deliveriesKey = (webhookId: string) => ['webhook-deliveries', webhookId] as const;

export function useWebhookEventsQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['webhook-events'] as const,
    queryFn: () => apiFetch<WebhookEvent[]>('/webhooks/events', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
    staleTime: Infinity,
  });
}

export function useWebhooksQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: WEBHOOKS_KEY,
    queryFn: () => apiFetch<WebhookSummary[]>('/webhooks', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
  });
}

export function useCreateWebhookMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { url: string; eventTypes: string[]; branchId?: string }) => apiFetch<CreatedWebhook>('/webhooks', { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WEBHOOKS_KEY }),
  });
}

export function useUpdateWebhookMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ webhookId, ...body }: { webhookId: string; url?: string; eventTypes?: string[]; branchId?: string | null; isActive?: boolean }) =>
      apiFetch<WebhookSummary>(`/webhooks/${webhookId}`, { method: 'PATCH', accessToken, tenantId, body }),
    onSuccess: (_data, { webhookId }) => {
      void queryClient.invalidateQueries({ queryKey: WEBHOOKS_KEY });
      void queryClient.invalidateQueries({ queryKey: deliveriesKey(webhookId) });
    },
  });
}

export function useTestWebhookMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (webhookId: string) => apiFetch<WebhookDelivery>(`/webhooks/${webhookId}/test`, { method: 'POST', accessToken, tenantId }),
    onSettled: (_data, _error, webhookId) => {
      void queryClient.invalidateQueries({ queryKey: WEBHOOKS_KEY });
      void queryClient.invalidateQueries({ queryKey: deliveriesKey(webhookId) });
    },
  });
}

export function useWebhookDeliveriesQuery(webhookId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: deliveriesKey(webhookId ?? ''),
    queryFn: () => apiFetch<WebhookDelivery[]>(`/webhooks/${webhookId}/deliveries`, { accessToken, tenantId }),
    enabled: webhookId !== null && tenantId !== undefined,
    // A delivery waiting on a retry changes on its own; the open log keeps up.
    refetchInterval: 15_000,
  });
}

export function useRetryDeliveryMutation(webhookId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deliveryId: string) => apiFetch<WebhookDelivery>(`/webhook-deliveries/${deliveryId}/retry`, { method: 'POST', accessToken, tenantId }),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: WEBHOOKS_KEY });
      void queryClient.invalidateQueries({ queryKey: deliveriesKey(webhookId) });
    },
  });
}
