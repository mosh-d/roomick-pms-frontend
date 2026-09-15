import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

export type CommsChannel = 'email' | 'sms' | 'push' | 'in_app_chat';
export type CommsDirection = 'inbound' | 'outbound';
export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'opened' | 'bounced';

/**
 * Mirrors `CommunicationLog` (roomick-pms-backend/prisma/schema.prisma). `inbound` rows are messages a guest sent in
 * (today from "Manage your booking", channel `in_app_chat`); `readAt` is when staff first read one.
 */
export interface CommunicationLogEntry {
  id: string;
  reservationId: string | null;
  guestId: string;
  channel: CommsChannel;
  direction: CommsDirection;
  subject: string | null;
  body: string;
  trigger: string;
  deliveryStatus: DeliveryStatus;
  sentBy: string | null;
  sentAt: string;
  deliveredAt: string | null;
  readAt: string | null;
}

export interface InboxReservation {
  id: string;
  confirmationNumber: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  room: { number: string } | null;
}

export interface InboxGuest {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
}

/** One guest who has written in — `GET /branches/:id/inbox`. */
export interface InboxConversation {
  guest: InboxGuest;
  reservation: InboxReservation | null;
  lastMessage: { direction: CommsDirection; channel: CommsChannel; trigger: string; preview: string; sentAt: string };
  unreadCount: number;
}

export interface InboxThread {
  guest: InboxGuest;
  reservations: InboxReservation[];
  messages: CommunicationLogEntry[];
}

export type InboxReplyChannel = 'in_app_chat' | 'email' | 'sms';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

export function useReservationCommunicationsQuery(reservationId: string | null, auth: AuthOpts) {
  return useQuery({
    queryKey: ['communications', 'reservation', reservationId] as const,
    queryFn: () => apiFetch<CommunicationLogEntry[]>(`/reservations/${reservationId}/communications`, auth),
    enabled: reservationId !== null,
  });
}

export function useGuestCommunicationsQuery(guestId: string | null, auth: AuthOpts) {
  return useQuery({
    queryKey: ['communications', 'guest', guestId] as const,
    queryFn: () => apiFetch<CommunicationLogEntry[]>(`/guests/${guestId}/communications`, auth),
    enabled: guestId !== null,
  });
}

export function useSendCommunicationMutation(auth: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      reservationId,
      ...body
    }: {
      reservationId: string;
      channel: 'email' | 'sms';
      subject?: string;
      body: string;
    }) => apiFetch<CommunicationLogEntry>(`/reservations/${reservationId}/communications/send`, { method: 'POST', ...auth, body }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['communications', 'reservation', variables.reservationId] });
      queryClient.invalidateQueries({ queryKey: ['communications', 'guest'] });
    },
  });
}

// --- Unified inbox (growth plan Month 9) -------------------------------------

function inboxKey(branchId: string) {
  return ['inbox', branchId] as const;
}

function threadKey(branchId: string, guestId: string) {
  return ['inbox-thread', branchId, guestId] as const;
}

/** A guest can write at any moment, so the inbox polls while it's open rather than asking staff to refresh. */
const INBOX_POLL_MS = 30_000;

export function useInboxQuery(branchId: string | null, filter: 'all' | 'unread', auth: AuthOpts) {
  return useQuery({
    queryKey: [...inboxKey(branchId ?? ''), filter] as const,
    queryFn: () => apiFetch<InboxConversation[]>(`/branches/${branchId}/inbox?filter=${filter}`, auth),
    enabled: branchId !== null,
    refetchInterval: INBOX_POLL_MS,
  });
}

export function useInboxThreadQuery(branchId: string | null, guestId: string | null, auth: AuthOpts) {
  return useQuery({
    queryKey: threadKey(branchId ?? '', guestId ?? ''),
    queryFn: () => apiFetch<InboxThread>(`/branches/${branchId}/inbox/${guestId}`, auth),
    enabled: branchId !== null && guestId !== null,
    refetchInterval: INBOX_POLL_MS,
  });
}

export function useMarkThreadReadMutation(branchId: string, auth: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (guestId: string) => apiFetch<{ marked: number }>(`/branches/${branchId}/inbox/${guestId}/read`, { method: 'POST', ...auth }),
    onSuccess: (_data, guestId) => {
      queryClient.invalidateQueries({ queryKey: inboxKey(branchId) });
      queryClient.invalidateQueries({ queryKey: threadKey(branchId, guestId) });
    },
  });
}

export function useInboxReplyMutation(branchId: string, auth: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ guestId, ...body }: { guestId: string; channel: InboxReplyChannel; subject?: string; body: string }) =>
      apiFetch<CommunicationLogEntry>(`/branches/${branchId}/inbox/${guestId}/reply`, { method: 'POST', ...auth, body }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: inboxKey(branchId) });
      queryClient.invalidateQueries({ queryKey: threadKey(branchId, variables.guestId) });
      queryClient.invalidateQueries({ queryKey: ['communications'] });
    },
  });
}
