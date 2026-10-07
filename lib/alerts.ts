import { useQuery } from '@tanstack/react-query';
import { apiFetch } from './api';
import type { FolioListRow } from './folios';

/** Just the fields `AlertsService`'s own `ALERT_RESERVATION_SELECT` (roomick-pms-backend) picks — a narrower shape than `ReservationSummary`, no rate-plan/no-show fields an alert row never shows. */
export interface AlertReservation {
  id: string;
  confirmationNumber: string;
  checkInDate: string;
  checkOutDate: string;
  guest: { id: string; name: string; phone: string | null };
  roomType: { name: string };
  room: { number: string } | null;
}

/** An overdue checkout: still in-house past the departure date, with what their bill stands at — they owe it as a guest-ledger balance, so they aren't repeated under Overdue Balances (which is for guests who have left). */
export interface OverdueCheckout extends AlertReservation {
  folioId: string | null;
  balanceDue: string;
  currency: string;
}

/** An unresolved work order that's urgent, or keeps a room out of service. */
export interface MaintenanceAlert {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'on_hold';
  takesRoomOutOfService: boolean;
  createdAt: string;
  room: { number: string } | null;
  assignedToUser: { name: string } | null;
}

/** Mirrors `AlertsService.getAlerts`'s response (roomick-pms-backend/src/modules/alerts/alerts.service.ts). Computed live on every call — nothing persisted, no dismiss/ack state; a row disappears the moment the real reservation/folio/work order it's derived from actually changes. */
export interface Alerts {
  missedCheckIns: AlertReservation[];
  overdueCheckouts: OverdueCheckout[];
  overdueBalances: FolioListRow[];
  maintenance: MaintenanceAlert[];
  total: number;
}

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/**
 * 60s polling, not a websocket push — this codebase has no real-time
 * push infrastructure yet (the in-house PMS this was ported from uses
 * Socket.IO; Roomick doesn't), and TanStack Query's own `refetchInterval`
 * is the idiomatic equivalent of that reference's own 60s HTTP-polling
 * fallback path. One query key shared by the sidebar badge and the
 * dedicated Alerts page — TanStack Query dedupes identical keys, so both
 * consumers read the same cached result instead of doubling the request.
 */
export function useAlertsQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['alerts', branchId] as const,
    queryFn: () => apiFetch<Alerts>(`/branches/${branchId}/alerts`, { accessToken, tenantId }),
    enabled: branchId !== null,
    refetchInterval: 60_000,
  });
}
