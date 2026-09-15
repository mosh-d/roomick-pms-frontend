import { keepPreviousData, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

/** Mirrors `OutletCategory` (roomick-pms-backend/prisma/schema.prisma). The category fixes the charge type on everything the outlet sells. */
export type OutletCategory = 'restaurant' | 'bar' | 'spa' | 'laundry' | 'retail' | 'room_service';
export type PosSettlement = 'room' | 'cash' | 'card';

export const OUTLET_CATEGORY_LABELS: Record<OutletCategory, string> = {
  restaurant: 'Restaurant',
  bar: 'Bar',
  spa: 'Spa',
  laundry: 'Laundry',
  retail: 'Retail',
  room_service: 'Room Service',
};

export const SETTLEMENT_LABELS: Record<PosSettlement, string> = {
  room: 'Room charge',
  cash: 'Cash',
  card: 'Card',
};

/** Mirrors `PosService.listOutlets` (roomick-pms-backend/src/modules/pos/pos.service.ts). */
export interface Outlet {
  id: string;
  branchId: string;
  name: string;
  category: OutletCategory;
  chargeType: string;
  isActive: boolean;
  sortOrder: number | null;
  menuItemCount: number;
  /** Managers only — who's assigned to ring up here. */
  assignedStaff?: Array<{ id: string; name: string }>;
}

/** Mirrors `ModifierGroup` (pos-pricing.ts). An option's price adds to the item's. */
export interface ModifierGroup {
  name: string;
  selection: 'single' | 'multi';
  required: boolean;
  options: Array<{ label: string; price: number }>;
}

export interface MenuItem {
  id: string;
  outletId: string;
  name: string;
  category: string;
  price: string;
  /** false = 86'd: greyed out on the terminal and refused by the server. */
  isAvailable: boolean;
  modifiers: ModifierGroup[] | null;
  sortOrder: number | null;
}

export interface OutletMenu {
  outlet: Omit<Outlet, 'menuItemCount' | 'assignedStaff'>;
  currency: string;
  items: MenuItem[];
}

/** One basket line as the terminal sends it — no prices, the server works them out. */
export interface BasketLine {
  menuItemId: string;
  qty: number;
  modifiers?: Array<{ group: string; options: string[] }>;
}

/** Mirrors `PricedLine` (pos-pricing.ts) — also what an order stores as its `items`. */
export interface PricedLine {
  menuItemId: string;
  name: string;
  qty: number;
  unitPrice: string;
  modifiers: Array<{ group: string; label: string; price: string }>;
  lineTotal: string;
}

export interface PosQuote {
  currency: string;
  lines: PricedLine[];
  subtotal: string;
  taxTotal: string;
  total: string;
}

export interface RoomGuest {
  reservationId: string;
  guestName: string;
  roomNumber: string;
  checkOutDate: string;
  /** The guest's bill is settled and closed — it takes no new charges until the desk reopens it. */
  billClosed: boolean;
}

/** Mirrors `ORDER_INCLUDE` + `cashierName` (pos.service.ts). */
export interface PosOrder {
  id: string;
  outletId: string;
  orderNo: number;
  settlement: PosSettlement;
  tableNumber: string | null;
  items: PricedLine[];
  subtotal: string;
  taxTotal: string;
  total: string;
  currency: string;
  reservationId: string | null;
  folioId: string | null;
  createdAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  outlet: { id: string; name: string; category: OutletCategory };
  branch: { name: string };
  reservation: { id: string; confirmationNumber: string; guest: { name: string }; room: { number: string } | null } | null;
  cashierName: string | null;
}

export interface OutletDay {
  date: string;
  currency: string;
  summary: { orderCount: number; voidCount: number; total: string; room: string; cash: string; card: string };
  orders: PosOrder[];
}

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

// --- Outlets --------------------------------------------------------------------

export function useOutletsQuery(branchId: string | null, auth: AuthOpts) {
  return useQuery({
    queryKey: ['pos-outlets', branchId ?? ''] as const,
    queryFn: () => apiFetch<Outlet[]>(`/branches/${branchId}/pos/outlets`, auth),
    enabled: branchId !== null,
  });
}

export function useCreateOutletMutation(branchId: string, auth: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { name: string; category: OutletCategory }) =>
      apiFetch<Outlet>(`/branches/${branchId}/pos/outlets`, { method: 'POST', ...auth, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pos-outlets', branchId] }),
  });
}

export function useUpdateOutletMutation(branchId: string, auth: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ outletId, ...body }: { outletId: string; name?: string; isActive?: boolean }) =>
      apiFetch<Outlet>(`/pos/outlets/${outletId}`, { method: 'PATCH', ...auth, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pos-outlets', branchId] }),
  });
}

/** Replaces one staff member's outlet assignments at the branch (the Users module's own endpoint). */
export function useSetStaffOutletsMutation(branchId: string, auth: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, outletIds }: { userId: string; outletIds: string[] }) =>
      apiFetch<unknown>(`/users/${userId}/outlets`, { method: 'PUT', ...auth, body: { branchId, outletIds } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff', branchId] });
      queryClient.invalidateQueries({ queryKey: ['pos-outlets', branchId] });
    },
  });
}

// --- Menu -------------------------------------------------------------------------

export function useOutletMenuQuery(outletId: string | null, auth: AuthOpts) {
  return useQuery({
    queryKey: ['pos-menu', outletId ?? ''] as const,
    queryFn: () => apiFetch<OutletMenu>(`/pos/outlets/${outletId}/menu`, auth),
    enabled: outletId !== null,
  });
}

function invalidateMenu(queryClient: QueryClient, outletId: string) {
  queryClient.invalidateQueries({ queryKey: ['pos-menu', outletId] });
  queryClient.invalidateQueries({ queryKey: ['pos-outlets'] }); // item counts
  queryClient.invalidateQueries({ queryKey: ['pos-quote', outletId] }); // a new price or an 86'd item changes an open basket
}

export type MenuItemInput = { name: string; category: string; price: number; modifiers: ModifierGroup[] };

export function useSaveMenuItemMutation(outletId: string, auth: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, ...body }: MenuItemInput & { itemId?: string }) =>
      itemId
        ? apiFetch<MenuItem>(`/pos/menu-items/${itemId}`, { method: 'PATCH', ...auth, body })
        : apiFetch<MenuItem>(`/pos/outlets/${outletId}/menu-items`, { method: 'POST', ...auth, body }),
    onSuccess: () => invalidateMenu(queryClient, outletId),
  });
}

export function useSetAvailabilityMutation(outletId: string, auth: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, isAvailable }: { itemId: string; isAvailable: boolean }) =>
      apiFetch<MenuItem>(`/pos/menu-items/${itemId}/availability`, { method: 'PATCH', ...auth, body: { isAvailable } }),
    onSuccess: () => invalidateMenu(queryClient, outletId),
  });
}

export function useDeleteMenuItemMutation(outletId: string, auth: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (itemId: string) => apiFetch<MenuItem>(`/pos/menu-items/${itemId}`, { method: 'DELETE', ...auth }),
    onSuccess: () => invalidateMenu(queryClient, outletId),
  });
}

// --- Selling ----------------------------------------------------------------------

/** The basket's price from the server — the terminal never adds anything up itself. Keeps the last figures on screen while a change re-prices. */
export function usePosQuoteQuery(outletId: string | null, lines: BasketLine[], auth: AuthOpts) {
  return useQuery({
    queryKey: ['pos-quote', outletId ?? '', lines] as const,
    queryFn: () => apiFetch<PosQuote>(`/pos/outlets/${outletId}/quote`, { method: 'POST', ...auth, body: { items: lines } }),
    enabled: outletId !== null && lines.length > 0,
    placeholderData: keepPreviousData,
    retry: false,
  });
}

export function useRoomLookupQuery(branchId: string | null, room: string | null, auth: AuthOpts) {
  return useQuery({
    queryKey: ['pos-room-lookup', branchId ?? '', room ?? ''] as const,
    queryFn: () => apiFetch<RoomGuest>(`/branches/${branchId}/pos/room-lookup?room=${encodeURIComponent(room ?? '')}`, auth),
    enabled: branchId !== null && room !== null && room !== '',
    retry: false,
    staleTime: 0,
  });
}

/** A sale moves money elsewhere too: a room charge onto a guest's folio, cash into the open shift's drawer. */
function invalidateAfterSale(queryClient: QueryClient, outletId: string) {
  queryClient.invalidateQueries({ queryKey: ['pos-orders', outletId] });
  queryClient.invalidateQueries({ queryKey: ['shift'] });
  queryClient.invalidateQueries({ predicate: (query) => typeof query.queryKey[0] === 'string' && query.queryKey[0].startsWith('folio') });
}

export function useCreateOrderMutation(auth: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { outletId: string; settlement: PosSettlement; items: BasketLine[]; reservationId?: string; tableNumber?: string }) =>
      apiFetch<PosOrder>('/pos/orders', { method: 'POST', ...auth, body }),
    onSuccess: (order) => invalidateAfterSale(queryClient, order.outletId),
  });
}

export function useOutletOrdersQuery(outletId: string | null, auth: AuthOpts) {
  return useQuery({
    queryKey: ['pos-orders', outletId ?? ''] as const,
    queryFn: () => apiFetch<OutletDay>(`/pos/outlets/${outletId}/orders`, auth),
    enabled: outletId !== null,
  });
}

export function useVoidOrderMutation(outletId: string, auth: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderId, reason }: { orderId: string; reason: string }) =>
      apiFetch<PosOrder>(`/pos/orders/${orderId}/void`, { method: 'POST', ...auth, body: { reason } }),
    onSuccess: () => invalidateAfterSale(queryClient, outletId),
  });
}
