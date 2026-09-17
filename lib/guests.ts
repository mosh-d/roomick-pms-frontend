import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

/** Mirrors `GuestsService`'s `GuestSummary` (roomick-pms-backend/src/modules/guests/guests.service.ts) — deliberately excludes ID-document/loyalty/preference fields; see `IdDocumentInput` for those. */
export interface GuestSummary {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Inline guest fields accepted by reservation-create/walk-in — no separate create call needed. */
export interface GuestInput {
  name: string;
  email?: string;
  phone?: string;
  notes?: string;
}

export const ID_DOC_TYPES = ['passport', 'national_id', 'drivers_license'] as const;
export type IdDocType = (typeof ID_DOC_TYPES)[number];

/** Mirrors `RecordIdDocumentDto` (roomick-pms-backend/src/modules/guests/dto/guest.dto.ts) — accepted inline on check-in/walk-in, never at guest creation. `photoBase64` has no `"data:"` prefix (the backend strips nothing, so the caller must). */
export interface IdDocumentInput {
  idDocType: IdDocType;
  idDocNumber: string;
  idDocExpiryDate?: string;
  nationality?: string;
  photoBase64?: string;
}

/** Wraps `GET /guests/search` — top 20 matches by name/email, requires a non-empty `q`. Used by quick "find one guest" pickers (GDPR request form, Rate Override); the browsable Guest Profiles & CRM list below is a separate, paginated endpoint that doesn't require `q`. */
export function useGuestSearchQuery(q: string, { accessToken, tenantId }: { accessToken: string | undefined; tenantId: string | undefined }) {
  return useQuery({
    queryKey: ['guests-search', q] as const,
    queryFn: () => apiFetch<GuestSummary[]>(`/guests/search?q=${encodeURIComponent(q)}`, { accessToken, tenantId }),
    enabled: q.trim().length > 0,
  });
}

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

export function useGuestsListQuery(q: string, page: number, { accessToken, tenantId }: AuthOpts) {
  const params = new URLSearchParams({ page: String(page), limit: '50' });
  if (q.trim()) params.set('q', q.trim());
  return useQuery({
    queryKey: ['guests-list', q, page] as const,
    queryFn: () => apiFetch<{ rows: GuestSummary[]; total: number; page: number; limit: number }>(`/guests?${params.toString()}`, { accessToken, tenantId }),
  });
}

export interface GuestPreferences {
  bedType?: string;
  floor?: string;
  view?: string;
  pillow?: string;
  temp?: string;
  dietaryRestrictions?: string[];
}

export interface GuestStaySummary {
  id: string;
  confirmationNumber: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  confirmedRate: string;
  roomType: { name: string };
}

export interface GuestNoteSummary {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string } | null;
}

/** Mirrors `GuestProfile` (roomick-pms-backend/src/modules/guests/guests.service.ts) — `GET /guests/:guestId`'s full response. */
export interface GuestProfileDetail extends GuestSummary {
  preferences: GuestPreferences | null;
  vipLevel: number | null;
  tags: string[];
  loyaltyTier: string | null;
  loyaltyPoints: number | null;
  stayHistory: GuestStaySummary[];
  totalSpend: string;
  notesFeed: GuestNoteSummary[];
}

function guestProfileQueryKey(guestId: string) {
  return ['guest-profile', guestId] as const;
}

export function useGuestProfileQuery(guestId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: guestProfileQueryKey(guestId ?? ''),
    queryFn: () => apiFetch<GuestProfileDetail>(`/guests/${guestId}`, { accessToken, tenantId }),
    enabled: guestId !== null,
  });
}

interface UpdateGuestInput {
  name?: string;
  email?: string;
  phone?: string;
  preferences?: GuestPreferences;
  vipLevel?: number;
  tags?: string[];
}

export function useUpdateGuestMutation(guestId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateGuestInput) => apiFetch<GuestProfileDetail>(`/guests/${guestId}`, { method: 'PATCH', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: guestProfileQueryKey(guestId) }),
  });
}

export function useAddGuestNoteMutation(guestId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => apiFetch<GuestNoteSummary>(`/guests/${guestId}/notes`, { method: 'POST', accessToken, tenantId, body: { body } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: guestProfileQueryKey(guestId) }),
  });
}
