import { useQuery } from '@tanstack/react-query';
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

/** Wraps `GET /guests/search` — top 20 matches by name/email. No dedicated Guest Profiles page exists yet (a confirmed, separately-tracked gap); this is just enough to let the GDPR request form find one specific guest. */
export function useGuestSearchQuery(q: string, { accessToken, tenantId }: { accessToken: string | undefined; tenantId: string | undefined }) {
  return useQuery({
    queryKey: ['guests-search', q] as const,
    queryFn: () => apiFetch<GuestSummary[]>(`/guests/search?q=${encodeURIComponent(q)}`, { accessToken, tenantId }),
    enabled: q.trim().length > 0,
  });
}
