import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

export type CommsChannel = 'email' | 'sms' | 'push' | 'in_app_chat';
export type DeliveryStatus = 'queued' | 'sent' | 'delivered' | 'failed' | 'opened' | 'bounced';

/** Mirrors `CommunicationLog` (roomick-pms-backend/prisma/schema.prisma). `deliveryStatus` stays `queued` for every row this pass writes — sending itself is stubbed for MVP; this is the record, not a mailer. */
export interface CommunicationLogEntry {
  id: string;
  reservationId: string | null;
  guestId: string;
  channel: CommsChannel;
  subject: string | null;
  body: string;
  trigger: string;
  deliveryStatus: DeliveryStatus;
  sentBy: string | null;
  sentAt: string;
  deliveredAt: string | null;
}

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
