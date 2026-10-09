import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/** Mirrors `CorporateAccountsService`'s list rows (roomick-pms-backend/src/modules/guests/corporate-accounts.service.ts). */
export interface CorporateAccount {
  id: string;
  name: string;
  emailDomains: string[];
  ratePlanId: string | null;
  contactName: string | null;
  contactEmail: string | null;
  /** Days the company has to pay an invoice; null = due on receipt. */
  paymentTermsDays: number | null;
  /** `{ address }` — printed on its invoices. */
  billingInfo: { address?: string } | null;
  isActive: boolean;
  createdAt: string;
  /** The contracted (negotiated) rate plan — it belongs to one branch, so the contract applies there. */
  ratePlan: { id: string; name: string; amount: string; branchId: string; isActive: boolean; branch: { name: string; currency: string } } | null;
  _count: { reservations: number };
}

export interface CorporateTraveler {
  guest: { id: string; name: string; email: string | null; phone: string | null };
  stays: number;
  lastStay: string;
}

export interface CorporateStay {
  id: string;
  confirmationNumber: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  confirmedRate: string;
  guest: { id: string; name: string };
  branch: { name: string; currency: string };
}

export interface CorporateAccountDetail extends CorporateAccount {
  travelers: CorporateTraveler[];
  recentStays: CorporateStay[];
}

export interface CorporateAccountInput {
  name: string;
  emailDomains: string[];
  ratePlanId: string | null;
  contactName?: string;
  contactEmail?: string;
  paymentTermsDays?: number | null;
  billingAddress?: string;
}

/** The active account whose email domains include this address's — a guest booked with a company address is offered the company's rate. */
export function accountForEmail(accounts: CorporateAccount[], email: string | undefined): CorporateAccount | null {
  const domain = email?.trim().toLowerCase().split('@')[1];
  if (!domain) return null;
  return accounts.find((account) => account.isActive && account.emailDomains.includes(domain)) ?? null;
}

const KEY = ['corporate-accounts'] as const;

export function useCorporateAccountsQuery({ accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<CorporateAccount[]>('/corporate-accounts', { accessToken, tenantId }),
    enabled: tenantId !== undefined,
  });
}

/** One page of the company list, found by name, contact or email domain — and how many match in all. */
export function useCorporateAccountsPageQuery(
  params: { search: string; page: number; pageSize: number },
  { accessToken, tenantId }: AuthOpts,
) {
  const query = new URLSearchParams();
  if (params.search.trim()) query.set('search', params.search.trim());
  const listQuery = new URLSearchParams(query);
  listQuery.set('limit', String(params.pageSize));
  listQuery.set('offset', String(params.page * params.pageSize));
  return useQuery({
    queryKey: [...KEY, 'page', params.search.trim(), params.page, params.pageSize] as const,
    queryFn: async () => {
      const [rows, total] = await Promise.all([
        apiFetch<CorporateAccount[]>(`/corporate-accounts?${listQuery.toString()}`, { accessToken, tenantId }),
        apiFetch<{ count: number }>(`/corporate-accounts/count${query.size ? `?${query.toString()}` : ''}`, { accessToken, tenantId }),
      ]);
      return { rows, total: total.count };
    },
    enabled: tenantId !== undefined,
    placeholderData: (previous) => previous,
  });
}

export function useCorporateAccountQuery(accountId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: [...KEY, accountId] as const,
    queryFn: () => apiFetch<CorporateAccountDetail>(`/corporate-accounts/${accountId}`, { accessToken, tenantId }),
    enabled: accountId !== null,
  });
}

export function useSaveCorporateAccountMutation({ accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ accountId, body }: { accountId: string | null; body: Partial<CorporateAccountInput> & { isActive?: boolean } }) =>
      accountId
        ? apiFetch<CorporateAccount>(`/corporate-accounts/${accountId}`, { method: 'PATCH', accessToken, tenantId, body })
        : apiFetch<CorporateAccount>('/corporate-accounts', { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
