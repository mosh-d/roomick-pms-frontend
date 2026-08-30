import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/** Mirrors `ApiKeySummary`/`CreatedApiKey` (roomick-pms-backend/src/modules/integrations/integrations.service.ts). `rawKey` only ever appears on the create response — never persisted client-side beyond that one render. */
export interface ApiKeySummary {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface CreatedApiKey extends ApiKeySummary {
  rawKey: string;
}

const API_KEYS_KEY = ['api-keys'] as const;

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
    mutationFn: (name: string) => apiFetch<CreatedApiKey>('/api-keys', { method: 'POST', accessToken, tenantId, body: { name } }),
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
  isActive: boolean;
  createdAt: string;
}

export interface CreatedWebhook extends WebhookSummary {
  secret: string;
}

const WEBHOOKS_KEY = ['webhooks'] as const;

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
    mutationFn: (body: { url: string; eventTypes: string[] }) => apiFetch<CreatedWebhook>('/webhooks', { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WEBHOOKS_KEY }),
  });
}

export function useDeactivateWebhookMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (webhookId: string) => apiFetch<WebhookSummary>(`/webhooks/${webhookId}`, { method: 'DELETE', accessToken, tenantId }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WEBHOOKS_KEY }),
  });
}
