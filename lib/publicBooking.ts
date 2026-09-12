import { useQuery, useMutation } from '@tanstack/react-query';
import { apiFetch } from './api';

/**
 * The Direct Booking Engine's client (Month 7).
 *
 * Deliberately takes NO auth options — every other lib/ module in this app
 * threads `{ accessToken, tenantId }` through because every other endpoint is
 * behind the JWT + X-Tenant-ID guard chain. These routes are `@Public()` and
 * resolve their tenant server-side from the booking slug, so passing either
 * header would be meaningless at best and a leak of a staff session onto a
 * guest-facing page at worst. `apiFetch` treats both as optional, so omitting
 * them sends a genuinely anonymous request.
 */

export interface PublicProperty {
  slug: string;
  name: string;
  category: string | null;
  currency: string;
  timezone: string;
  checkInTime: string;
  checkOutTime: string;
  address: { street?: string; city?: string; state?: string; country?: string; zip?: string } | null;
  brandName: string;
}

export interface PublicRoomType {
  id: string;
  name: string;
  bedType: string | null;
  sizeM2: string | null;
  amenities: string[];
  photoUrls: string[];
  baseRate: string;
  maxAdults: number;
  maxChildren: number;
}

export interface PublicAvailabilityNight {
  date: string;
  available: number;
}

export interface PublicAvailabilityRow {
  roomTypeId: string;
  roomTypeName: string;
  nights: PublicAvailabilityNight[];
}

export interface PublicQuote {
  currency: string;
  nightlyRate: string;
  subtotal: string;
  taxTotal: string;
  totalWithTax: string;
  nights: number;
}

export interface PublicBookingConfirmation {
  confirmationNumber: string;
  checkInDate: string;
  checkOutDate: string;
  roomTypeName: string;
  guestName: string;
  totalRate: string;
  currency: string;
}

export interface PublicBookingRequest {
  roomTypeId: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children?: number;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;
  specialRequests?: string;
  promoCode?: string;
}

export function usePublicPropertyQuery(slug: string) {
  return useQuery({
    queryKey: ['public-property', slug] as const,
    queryFn: () => apiFetch<PublicProperty>(`/public/properties/${slug}`, {}),
    // A property that doesn't resolve won't start resolving on a retry —
    // the 404 is deliberate and final (unpublished, suspended, or never real).
    retry: false,
  });
}

export function usePublicRoomTypesQuery(slug: string, enabled: boolean) {
  return useQuery({
    queryKey: ['public-room-types', slug] as const,
    queryFn: () => apiFetch<PublicRoomType[]>(`/public/properties/${slug}/room-types`, {}),
    enabled,
  });
}

export function usePublicAvailabilityQuery(slug: string, from: string, to: string, enabled: boolean) {
  return useQuery({
    queryKey: ['public-availability', slug, from, to] as const,
    queryFn: () => apiFetch<PublicAvailabilityRow[]>(`/public/properties/${slug}/availability?from=${from}&to=${to}`, {}),
    enabled,
  });
}

export function usePublicQuoteQuery(slug: string, roomTypeId: string | null, checkInDate: string, checkOutDate: string, promoCode: string, enabled: boolean) {
  return useQuery({
    queryKey: ['public-quote', slug, roomTypeId, checkInDate, checkOutDate, promoCode] as const,
    queryFn: () => {
      const params = new URLSearchParams({ roomTypeId: roomTypeId ?? '', checkInDate, checkOutDate });
      if (promoCode.trim()) params.set('promoCode', promoCode.trim());
      return apiFetch<PublicQuote>(`/public/properties/${slug}/quote?${params.toString()}`, {});
    },
    enabled: enabled && roomTypeId !== null,
  });
}

export interface PublicBookingDetail {
  confirmationNumber: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  specialRequests: string | null;
  roomTypeName: string;
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  guestNationality: string | null;
  totalRate: string;
  currency: string;
  preArrivalCompletedAt: string | null;
  estimatedArrivalTime: string | null;
  houseRules: string | null;
  property: PublicProperty;
}

export interface PreArrivalRequest {
  confirmationNumber: string;
  email: string;
  phone?: string;
  nationality?: string;
  estimatedArrivalTime?: string;
  acceptHouseRules: boolean;
}

/** Returns the same `PublicBookingDetail` the lookup does, so the page can render the updated booking without a second round trip. */
export function usePreArrivalMutation(slug: string) {
  return useMutation({
    mutationFn: (body: PreArrivalRequest) => apiFetch<PublicBookingDetail>(`/public/properties/${slug}/bookings/pre-arrival`, { method: 'POST', body }),
  });
}

/**
 * A mutation rather than a query even though it reads: it's a POST carrying a
 * confirmation number and email (deliberately not in a query string), and it
 * should only ever run when the guest actually submits the form — never
 * automatically on mount or refocus, which is what a `useQuery` would do.
 */
export function useBookingLookupMutation(slug: string) {
  return useMutation({
    mutationFn: (body: { confirmationNumber: string; email: string }) =>
      apiFetch<PublicBookingDetail>(`/public/properties/${slug}/bookings/lookup`, { method: 'POST', body }),
  });
}

export interface PublicFolioLine {
  description: string;
  chargeType: string;
  amount: string;
  serviceDate: string | null;
  postedAt: string;
}

export interface PublicFolioPayment {
  method: string;
  purpose: string;
  amount: string;
  recordedAt: string;
}

/** Mirrors the backend's `PublicGuestFolio` — `getFolio`'s own totals, projected to guest-safe fields. */
export interface PublicGuestFolio {
  confirmationNumber: string;
  currency: string;
  lineItems: PublicFolioLine[];
  payments: PublicFolioPayment[];
  subTotal: string;
  taxTotal: string;
  totalCost: string;
  paymentsTotal: string;
  balanceDue: string;
  stillAccruing: boolean;
  roomTotalForStay: string | null;
  otherFoliosExist: boolean;
  asOf: string;
}

/**
 * A mutation, fired from an explicit "View your bill" button, for the same
 * reason the lookup is one: it POSTs credentials to a hard-throttled route, and
 * should spend that budget only when the guest actually asks — never on mount
 * or window refocus.
 */
export function useGuestFolioMutation(slug: string) {
  return useMutation({
    mutationFn: (body: { confirmationNumber: string; email: string }) =>
      apiFetch<PublicGuestFolio>(`/public/properties/${slug}/bookings/folio`, { method: 'POST', body }),
  });
}

export function usePublicBookingMutation(slug: string) {
  return useMutation({
    mutationFn: (body: PublicBookingRequest) => apiFetch<PublicBookingConfirmation>(`/public/properties/${slug}/reservations`, { method: 'POST', body }),
  });
}
