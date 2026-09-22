import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/** Mirrors `SegmentCriteria` (roomick-pms-backend/src/modules/marketing/segment-rules.ts). Every rule is optional and they AND together. */
export interface SegmentCriteria {
  vipLevelMin?: number;
  loyaltyTiers?: string[];
  tags?: string[];
  nationalities?: string[];
  branchIds?: string[];
  minStays?: number;
  minTotalSpend?: number;
  lastStayWithinDays?: number;
  notStayedForDays?: number;
}

export interface Segment {
  id: string;
  name: string;
  description: string | null;
  criteria: SegmentCriteria;
  /** The rules in plain English, as the server reads them. */
  rules: string[];
  createdAt: string;
  updatedAt: string;
}

export interface SegmentPreview {
  matching: number;
  /** Of `matching`, the guests a campaign can actually reach: opted in, with an email address. */
  reachable: number;
  rules: string[];
  sample: Array<{ id: string; name: string; email: string | null; loyaltyTier: string | null; vipLevel: number | null }>;
  tooLarge: boolean;
}

export interface MessageTemplate {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface MergeField {
  token: string;
  label: string;
  example: string;
}

export interface TemplatePreview {
  subject: string;
  text: string;
  html: string;
}

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled' | 'failed';

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  sending: 'Sending',
  sent: 'Sent',
  cancelled: 'Cancelled',
  failed: 'Failed',
};

export interface CampaignSummary {
  id: string;
  name: string;
  channel: string;
  status: CampaignStatus;
  segmentName: string;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number;
  opened: number;
  clicked: number;
  failureReason: string | null;
}

export interface CampaignPerformance {
  recipients: number;
  sent: number;
  failed: number;
  queued: number;
  opened: number;
  clicked: number;
  unsubscribed: number;
  openRate: number | null;
  clickRate: number | null;
  byVariant: Array<{ variant: string; recipients: number; opened: number; clicked: number }>;
  bookingsAfterSend: number | null;
}

export interface Campaign {
  id: string;
  branchId: string;
  name: string;
  channel: string;
  status: CampaignStatus;
  subject: string | null;
  segment: { id: string; name: string; rules: string[] };
  template: { id: string; name: string };
  variantTemplate: { id: string; name: string } | null;
  splitRatio: string | null;
  scheduledAt: string | null;
  sentAt: string | null;
  recipientCount: number;
  failureReason: string | null;
  createdAt: string;
  performance: CampaignPerformance;
  recipients: Array<{
    id: string;
    guestId: string;
    guestName: string;
    email: string | null;
    variant: string;
    deliveryStatus: string | null;
    openedAt: string | null;
    clickedAt: string | null;
    unsubscribedAt: string | null;
  }>;
}

export interface CampaignInput {
  name: string;
  channel: 'email';
  segmentId: string;
  templateId: string;
  subject?: string;
  scheduledAt?: string;
  abTest?: { variantTemplateId: string; splitRatio: number };
}

/** Matches CONVERSION_WINDOW_DAYS on the server — the window "bookings after the send" is counted over. */
export const CONVERSION_WINDOW_DAYS = 30;

function invalidateMarketing(queryClient: QueryClient) {
  queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('marketing-') });
}

// --- Segments -----------------------------------------------------------------

export function useSegmentsQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['marketing-segments'] as const,
    queryFn: () => apiFetch<Segment[]>('/marketing/segments', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
  });
}

export function useSaveSegmentMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id?: string; name: string; description?: string; criteria: SegmentCriteria }) =>
      apiFetch<Segment>(id ? `/marketing/segments/${id}` : '/marketing/segments', { method: id ? 'PUT' : 'POST', accessToken, tenantId, body }),
    onSuccess: () => invalidateMarketing(queryClient),
  });
}

export function useDeleteSegmentMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ deleted: true }>(`/marketing/segments/${id}`, { method: 'DELETE', accessToken, tenantId }),
    onSuccess: () => invalidateMarketing(queryClient),
  });
}

/** A mutation rather than a query: it runs on demand against rules still being edited, not on a cache key. */
export function usePreviewSegmentMutation({ accessToken, tenantId }: AuthOpts) {
  return useMutation({
    mutationFn: (criteria: SegmentCriteria) => apiFetch<SegmentPreview>('/marketing/segments/preview', { method: 'POST', accessToken, tenantId, body: { criteria } }),
  });
}

// --- Templates ----------------------------------------------------------------

export function useTemplatesQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['marketing-templates'] as const,
    queryFn: () => apiFetch<MessageTemplate[]>('/marketing/templates', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
  });
}

export function useMergeFieldsQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['marketing-merge-fields'] as const,
    queryFn: () => apiFetch<MergeField[]>('/marketing/merge-fields', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
    staleTime: Infinity,
  });
}

export function useSaveTemplateMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id?: string; name: string; subject?: string; body: string }) =>
      apiFetch<MessageTemplate>(id ? `/marketing/templates/${id}` : '/marketing/templates', { method: id ? 'PUT' : 'POST', accessToken, tenantId, body }),
    onSuccess: () => invalidateMarketing(queryClient),
  });
}

export function useDeleteTemplateMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch<{ deleted: true }>(`/marketing/templates/${id}`, { method: 'DELETE', accessToken, tenantId }),
    onSuccess: () => invalidateMarketing(queryClient),
  });
}

export function usePreviewTemplateMutation({ accessToken, tenantId }: AuthOpts) {
  return useMutation({
    mutationFn: (body: { body: string; subject?: string }) => apiFetch<TemplatePreview>('/marketing/templates/preview', { method: 'POST', accessToken, tenantId, body }),
  });
}

// --- Campaigns ----------------------------------------------------------------

export function useCampaignsQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['marketing-campaigns', branchId ?? ''] as const,
    queryFn: () => apiFetch<CampaignSummary[]>(`/branches/${branchId}/marketing/campaigns`, { accessToken, tenantId }),
    enabled: branchId !== null && tenantId !== undefined,
  });
}

export function useCampaignQuery(campaignId: string, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['marketing-campaign', campaignId] as const,
    queryFn: () => apiFetch<Campaign>(`/marketing/campaigns/${campaignId}`, { accessToken, tenantId }),
    enabled: tenantId !== undefined,
    // Opens and clicks keep arriving after a send; a minute is plenty for a dashboard someone is watching.
    refetchInterval: 60_000,
  });
}

export function useCreateCampaignMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CampaignInput) => apiFetch<Campaign>(`/branches/${branchId}/marketing/campaigns`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => invalidateMarketing(queryClient),
  });
}

export function useUpdateCampaignMutation(campaignId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: Partial<Omit<CampaignInput, 'channel' | 'scheduledAt' | 'abTest'>> & { scheduledAt?: string | null; abTest?: CampaignInput['abTest'] | null }) =>
      apiFetch<Campaign>(`/marketing/campaigns/${campaignId}`, { method: 'PATCH', accessToken, tenantId, body }),
    onSuccess: () => invalidateMarketing(queryClient),
  });
}

export function useSendCampaignMutation(campaignId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<Campaign>(`/marketing/campaigns/${campaignId}/send`, { method: 'POST', accessToken, tenantId }),
    // Also on error: a refused send records its reason on the campaign, and the page should show it.
    onSettled: () => invalidateMarketing(queryClient),
  });
}

export function useSendTestMutation(campaignId: string, { accessToken, tenantId }: AuthOpts) {
  return useMutation({
    mutationFn: (email: string) => apiFetch<{ sentTo: string }>(`/marketing/campaigns/${campaignId}/test`, { method: 'POST', accessToken, tenantId, body: { email } }),
  });
}

export function useCancelCampaignMutation(campaignId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<Campaign>(`/marketing/campaigns/${campaignId}/cancel`, { method: 'POST', accessToken, tenantId }),
    onSuccess: () => invalidateMarketing(queryClient),
  });
}

// --- Consent ------------------------------------------------------------------

export function useSetMarketingConsentMutation(guestId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (optIn: boolean) =>
      apiFetch<{ marketingOptIn: boolean; marketingOptInAt: string | null }>(`/guests/${guestId}/marketing-consent`, {
        method: 'PUT',
        accessToken,
        tenantId,
        body: { optIn },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guest-profile'] });
      invalidateMarketing(queryClient);
    },
  });
}

/** Rounded to whole percent for a table, one decimal on the dashboard. `null` = nothing sent yet, shown as a dash rather than 0%. */
export function formatRate(rate: number | null, digits = 0): string {
  return rate === null ? '—' : `${(rate * 100).toFixed(digits)}%`;
}

export const CONSENT_SOURCE_LABELS: Record<string, string> = {
  booking_engine: 'the booking page',
  guest_portal: 'online check-in',
  front_desk: 'the front desk',
};

export interface DeliveryStatus {
  transport: string;
  /** False with the development `log` transport: a campaign reaches "sent" and nothing leaves the server. */
  deliversExternally: boolean;
}

export function useDeliveryStatusQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['marketing-delivery'] as const,
    queryFn: () => apiFetch<DeliveryStatus>('/marketing/delivery', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
    staleTime: 5 * 60_000,
  });
}
