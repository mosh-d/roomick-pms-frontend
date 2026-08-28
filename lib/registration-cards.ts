import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

/** Snapshotted at generation time — see the backend's own `generateCardInTx` comment on why ID-document fields are absent (never collected in the first place). */
export interface RegistrationCardFields {
  guestName: string;
  guestEmail: string | null;
  guestPhone: string | null;
  roomNumber: string | null;
  roomType: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  rate: string;
  currency: string;
  confirmationNumber: string;
  houseRules: string | null;
  logoUrl: string | null;
}

/** Mirrors `RegistrationCard` (roomick-pms-backend/prisma/schema.prisma). */
export interface RegistrationCard {
  id: string;
  reservationId: string;
  guestId: string;
  fields: RegistrationCardFields;
  signatureData: string | null;
  signedAt: string | null;
  witnessedBy: string | null;
  generatedAt: string;
}

export interface RegCardTemplate {
  logoUrl?: string;
  houseRules?: string;
  requiredFields?: string[];
  showRate?: boolean;
  language?: string;
}

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

export function useRegistrationCardForReservationQuery(reservationId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['registration-card', 'for-reservation', reservationId] as const,
    queryFn: () => apiFetch<RegistrationCard | null>(`/reservations/${reservationId}/registration-card`, { accessToken, tenantId }),
    enabled: reservationId !== null,
  });
}

export function useRegistrationCardQuery(cardId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['registration-card', cardId] as const,
    queryFn: () => apiFetch<RegistrationCard>(`/registration-cards/${cardId}`, { accessToken, tenantId }),
    enabled: cardId !== null,
  });
}

export function useGenerateRegistrationCardMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reservationId: string) =>
      apiFetch<RegistrationCard>(`/reservations/${reservationId}/registration-card/generate`, { method: 'POST', accessToken, tenantId }),
    onSuccess: (card) => {
      queryClient.invalidateQueries({ queryKey: ['registration-card', 'for-reservation', card.reservationId] });
    },
  });
}

export function useSignRegistrationCardMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cardId, signatureData }: { cardId: string; signatureData: string }) =>
      apiFetch<RegistrationCard>(`/registration-cards/${cardId}/sign`, { method: 'POST', accessToken, tenantId, body: { signatureData } }),
    onSuccess: (card) => {
      queryClient.invalidateQueries({ queryKey: ['registration-card', card.id] });
      queryClient.invalidateQueries({ queryKey: ['registration-card', 'for-reservation', card.reservationId] });
    },
  });
}

export function useRegCardTemplateQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: ['reg-card-template', branchId] as const,
    queryFn: () => apiFetch<RegCardTemplate>(`/branches/${branchId}/registration-card-template`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useSetRegCardTemplateMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (template: RegCardTemplate) =>
      apiFetch(`/branches/${branchId}/registration-card-template`, { method: 'PATCH', accessToken, tenantId, body: template }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reg-card-template', branchId] }),
  });
}
