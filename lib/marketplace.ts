import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiFetch, downloadFile } from './api';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/** Mirrors the backend's `MarketplaceListing` (roomick-pms-backend/src/modules/marketplace/marketplace.service.ts). */
export interface MarketplaceListing {
  key: string;
  name: string;
  vendor: string;
  category: string;
  categoryLabel: string;
  summary: string;
  howItWorks: string;
  availability: 'available' | 'coming_later';
  waitingOn?: string;
  connection: {
    status: 'enabled' | 'disabled';
    enabledAt: string;
    disabledAt: string | null;
    lastRunAt: string | null;
    lastRunSummary: string | null;
  } | null;
}

export interface MarketplaceView {
  categories: Array<{ key: string; label: string }>;
  listings: MarketplaceListing[];
}

export interface AccountingConfig {
  dateFormat: string;
  accounts: {
    receivable: string;
    taxPayable: string;
    revenue: Record<string, string>;
    payments: Record<string, string>;
  };
  xeroTaxRate: string;
}

export interface ReviewRequestConfig {
  delayHours: number;
  links: Record<string, string>;
  subject: string;
  message: string;
}

export type ListingSetup =
  | { kind: 'accounting'; departments: Array<{ key: string; label: string }>; methods: Array<{ key: string; label: string }>; dateFormats: string[] }
  | { kind: 'review_requests'; properties: Array<{ id: string; name: string }>; placeholders: string[] }
  | { kind: 'none' };

export interface ListingDetail extends MarketplaceListing {
  config: AccountingConfig | ReviewRequestConfig | null;
  /** false until it has been set up once — the settings shown are then only suggestions. */
  configured: boolean;
  setup: ListingSetup;
}

export interface JournalPreview {
  provider: string;
  from: string;
  to: string;
  currency: string;
  property: string;
  journals: Array<{
    date: string;
    number: string;
    lines: Array<{ account: string; debit: string; credit: string; description: string }>;
    totalDebit: string;
    totalCredit: string;
  }>;
  lineCount: number;
}

/** Whether a listing is on, off, never set up, or can't be set up yet — the one badge every card and page shows. */
export type ListingState = 'on' | 'off' | 'not_set_up' | 'coming_later';

export function listingState(listing: MarketplaceListing): ListingState {
  if (listing.availability === 'coming_later') return 'coming_later';
  if (!listing.connection) return 'not_set_up';
  return listing.connection.status === 'enabled' ? 'on' : 'off';
}

export const LISTING_STATE_LABELS: Record<ListingState, string> = {
  on: 'On',
  off: 'Off',
  not_set_up: 'Available',
  coming_later: 'Coming later',
};

function invalidateMarketplace(queryClient: QueryClient) {
  queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('marketplace') });
}

export function useMarketplaceQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['marketplace'] as const,
    queryFn: () => apiFetch<MarketplaceView>('/integrations/marketplace', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
  });
}

export function useListingQuery(provider: string, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['marketplace-listing', provider] as const,
    queryFn: () => apiFetch<ListingDetail>(`/integrations/marketplace/${provider}`, { accessToken, tenantId }),
    enabled: tenantId !== undefined,
  });
}

export function useSaveConnectionMutation(provider: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (config: AccountingConfig | ReviewRequestConfig) =>
      apiFetch<ListingDetail>(`/integrations/marketplace/${provider}`, { method: 'PUT', accessToken, tenantId, body: { config } }),
    onSuccess: () => invalidateMarketplace(queryClient),
  });
}

export function useDisableConnectionMutation(provider: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<ListingDetail>(`/integrations/marketplace/${provider}`, { method: 'DELETE', accessToken, tenantId }),
    onSuccess: () => invalidateMarketplace(queryClient),
  });
}

/** On demand, for the range typed in — a mutation rather than a query keyed on half-typed dates. */
export function useJournalPreviewMutation(provider: string, branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useMutation({
    mutationFn: ({ from, to }: { from: string; to: string }) =>
      apiFetch<JournalPreview>(`/branches/${branchId}/integrations/accounting/${provider}/preview?from=${from}&to=${to}`, { accessToken, tenantId }),
  });
}

export function downloadJournals(provider: string, branchId: string, range: { from: string; to: string }, auth: AuthOpts): Promise<void> {
  const name = provider === 'xero' ? 'xero-manual-journals' : 'quickbooks-journal-entries';
  return downloadFile(
    `/branches/${branchId}/integrations/accounting/${provider}/export?from=${range.from}&to=${range.to}`,
    `${name}-${range.from}-to-${range.to}.csv`,
    auth,
  );
}

export function useReviewPreviewQuery(branchId: string | null, enabled: boolean, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['marketplace-review-preview', branchId ?? ''] as const,
    queryFn: () =>
      apiFetch<{ subject: string; body: string; reviewUrl: string | null }>(`/branches/${branchId}/integrations/review-requests/preview`, { accessToken, tenantId }),
    enabled: enabled && branchId !== null && tenantId !== undefined,
  });
}
