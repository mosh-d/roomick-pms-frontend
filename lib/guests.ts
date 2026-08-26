/** Mirrors `GuestsService`'s `GuestSummary` (roomick-pms-backend/src/modules/guests/guests.service.ts) — deliberately excludes ID-document/loyalty/preference fields, not built this pass. */
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
