import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch } from './api';
import type { AuthUser } from './store/authStore';
import type { ChargeType } from './folios';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/** Mirrors `TaxRule` (roomick-pms-backend/prisma/schema.prisma). Money and rates arrive as decimal strings. */
export interface TaxRule {
  id: string;
  branchId: string;
  name: string;
  type: 'percentage' | 'fixed';
  /** Percentage rules: "0.075" = 7.5%. "0" for a fixed rule. */
  rate: string;
  /** Fixed rules: the amount per charge (per night on rooms). */
  fixedAmount: string | null;
  /** true: already inside the price. false: added on top. */
  inclusive: boolean;
  /** Empty = every charge. */
  appliesToChargeTypes: ChargeType[];
  jurisdiction: string | null;
  isActive: boolean;
  createdAt: string;
}

/** The body `POST /branches/:id/tax-rules` and `POST /tax-rules/:id/replace` take. */
export interface TaxRuleBody {
  name: string;
  type: 'percentage' | 'fixed';
  rate?: number;
  fixedAmount?: number;
  inclusive: boolean;
  appliesToChargeTypes: ChargeType[];
}

/** The charge types a rule can name — `tax` and `correction` are never taxed. */
export const TAXABLE_CHARGE_TYPES: Array<{ value: ChargeType; label: string }> = [
  { value: 'room', label: 'Rooms' },
  { value: 'fnb', label: 'Food and Drinks' },
  { value: 'laundry', label: 'Laundry' },
  { value: 'spa', label: 'Spa' },
  { value: 'minibar', label: 'Minibar' },
  { value: 'transport', label: 'Transport' },
  { value: 'penalty', label: 'Cancellation & No-Show Charges' },
  { value: 'misc', label: 'Other Charges' },
];

/** The "All" choice in an Applies-to picker — stored as an empty list. */
export const ALL_CHARGES = 'all';

/** What the tax rule builder edits — one rule, as typed. */
export interface TaxRuleDraftValues {
  name: string;
  inclusive: boolean;
  type: 'percentage' | 'fixed';
  /** A percentage ("7.5") or an amount ("500"), as typed. */
  value: string;
  /** Charge types, or `[ALL_CHARGES]`. */
  appliesTo: string[];
}

export function emptyTaxRuleDraft(): TaxRuleDraftValues {
  return { name: '', inclusive: false, type: 'percentage', value: '', appliesTo: [] };
}

/** A saved rule back into the builder's shape — for changing it. */
export function draftFromRule(rule: TaxRule): TaxRuleDraftValues {
  return {
    name: rule.name,
    inclusive: rule.inclusive,
    type: rule.type,
    value: rule.type === 'fixed' ? String(Number(rule.fixedAmount ?? 0)) : String(Number((Number(rule.rate) * 100).toFixed(2))),
    appliesTo: rule.appliesToChargeTypes.length === 0 ? [ALL_CHARGES] : rule.appliesToChargeTypes,
  };
}

/** What stops a rule being saved, in words; `null` when it's ready. */
export function taxRuleProblem(draft: TaxRuleDraftValues): string | null {
  if (!draft.name.trim()) return 'Give the tax a name, such as VAT';
  const amount = Number(draft.value);
  if (draft.value.trim() === '' || !Number.isFinite(amount) || amount <= 0) {
    return draft.type === 'fixed' ? 'Enter the amount, above zero' : 'Enter the percentage, above zero';
  }
  if (draft.type === 'percentage' && (amount > 100 || !/^\d+(\.\d{1,2})?$/.test(draft.value.trim()))) {
    return 'A percentage runs up to 100, with at most two decimal places';
  }
  if (draft.type === 'fixed' && !/^\d+(\.\d{1,2})?$/.test(draft.value.trim())) return 'An amount takes at most two decimal places';
  if (draft.appliesTo.length === 0) return 'Tick what it applies to — or All';
  return null;
}

export function toTaxRuleBody(draft: TaxRuleDraftValues): TaxRuleBody {
  const amount = Number(draft.value);
  const appliesToChargeTypes = draft.appliesTo.includes(ALL_CHARGES) ? [] : (draft.appliesTo as ChargeType[]);
  return draft.type === 'fixed'
    ? { name: draft.name.trim(), type: 'fixed', fixedAmount: amount, inclusive: draft.inclusive, appliesToChargeTypes }
    : { name: draft.name.trim(), type: 'percentage', rate: Number((amount / 100).toFixed(4)), inclusive: draft.inclusive, appliesToChargeTypes };
}

/** "7.5%" or "₦500.00 a charge" — `symbol` is the branch currency's. */
export function describeTaxAmount(rule: Pick<TaxRule, 'type' | 'rate' | 'fixedAmount'>, symbol: string): string {
  if (rule.type === 'fixed') {
    const amount = Number(rule.fixedAmount ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${symbol}${amount} a charge`;
  }
  return `${Number((Number(rule.rate) * 100).toFixed(2))}%`;
}

export function describeAppliesTo(types: ChargeType[]): string {
  if (types.length === 0) return 'All charges';
  return types.map((type) => TAXABLE_CHARGE_TYPES.find((option) => option.value === type)?.label ?? type).join(', ');
}

/** A draft rule in one line — "7.5% · Inclusive · Rooms, Food and Drinks" — for summaries before it's saved. */
export function describeTaxRuleDraft(draft: TaxRuleDraftValues, symbol: string): string {
  const body = toTaxRuleBody(draft);
  const amount =
    body.type === 'fixed'
      ? describeTaxAmount({ type: 'fixed', rate: '0', fixedAmount: String(body.fixedAmount ?? 0) }, symbol)
      : describeTaxAmount({ type: 'percentage', rate: String(body.rate ?? 0), fixedAmount: null }, symbol);
  return `${amount} · ${draft.inclusive ? 'Inclusive' : 'Exclusive'} · ${describeAppliesTo(body.appliesToChargeTypes)}`;
}

/** Who may change a branch's taxes — mirrors the backend's `TAX_ADMIN_ROLES`. UX only; the server decides. */
export function canManageTaxes(user: AuthUser | null, branchId: string): boolean {
  if (!user) return false;
  return user.roles.some((r) => ['owner', 'manager', 'accountant'].includes(r.role) && (r.branchId === null || r.branchId === branchId));
}

function taxRulesKey(branchId: string) {
  return ['tax-rules', branchId] as const;
}

export function useTaxRulesQuery(branchId: string | null, { accessToken, tenantId }: AuthOpts) {
  return useQuery({
    queryKey: taxRulesKey(branchId ?? ''),
    queryFn: () => apiFetch<TaxRule[]>(`/branches/${branchId}/tax-rules`, { accessToken, tenantId }),
    enabled: branchId !== null,
  });
}

export function useCreateTaxRuleMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: TaxRuleBody) => apiFetch<TaxRule>(`/branches/${branchId}/tax-rules`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taxRulesKey(branchId) }),
  });
}

/** A new rate, amount or scope: the server retires the rule and creates its replacement together. */
export function useReplaceTaxRuleMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, body }: { ruleId: string; body: TaxRuleBody }) =>
      apiFetch<TaxRule>(`/tax-rules/${ruleId}/replace`, { method: 'POST', accessToken, tenantId, body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taxRulesKey(branchId) }),
  });
}

export function useSetTaxRuleActiveMutation(branchId: string, { accessToken, tenantId }: AuthOpts) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ ruleId, isActive }: { ruleId: string; isActive: boolean }) =>
      apiFetch<TaxRule>(`/tax-rules/${ruleId}`, { method: 'PATCH', accessToken, tenantId, body: { isActive } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taxRulesKey(branchId) }),
  });
}
