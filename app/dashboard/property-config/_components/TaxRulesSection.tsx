'use client';

import { useState } from 'react';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Table, type TableColumn } from '@/components/ui/Table';
import { TaxRuleFields } from '@/components/tax/TaxRuleFields';
import {
  canManageTaxes,
  describeAppliesTo,
  describeTaxAmount,
  draftFromRule,
  emptyTaxRuleDraft,
  taxRuleProblem,
  toTaxRuleBody,
  useCreateTaxRuleMutation,
  useReplaceTaxRuleMutation,
  useSetTaxRuleActiveMutation,
  useTaxRulesQuery,
  type TaxRule,
  type TaxRuleDraftValues,
} from '@/lib/taxes';
import { currencySymbolFor } from '@/lib/currencies';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

function errorText(err: unknown): string {
  return err instanceof ApiError ? err.message : 'Something went wrong. Please try again.';
}

/**
 * The branch's tax rules — the reference's Tax Rule Builder, after
 * onboarding. Rules are never edited in place: bills already posted point at
 * the rule they were charged under, so **Change** retires the rule and puts
 * its replacement in one step (the server does both together), and
 * **Retire** stops it applying to anything new. Retired rules stay listed,
 * and can be reinstated.
 *
 * Everyone who can open the page sees the rules; only an owner, manager or
 * accountant at this branch gets the buttons — the server checks the same.
 */
export function TaxRulesSection({ branchId, currency, auth }: { branchId: string; currency: string; auth: AuthOpts }) {
  const user = useAuthStore((s) => s.user);
  const rulesQuery = useTaxRulesQuery(branchId, auth);
  const setActiveMutation = useSetTaxRuleActiveMutation(branchId, auth);
  const [editing, setEditing] = useState<{ rule: TaxRule | null } | null>(null);
  const [retiring, setRetiring] = useState<TaxRule | null>(null);
  const [showRetired, setShowRetired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = canManageTaxes(user, branchId);
  const symbol = currencySymbolFor(currency);
  const rules = rulesQuery.data ?? [];
  const active = rules.filter((r) => r.isActive);
  const retired = rules.filter((r) => !r.isActive);

  function setActive(rule: TaxRule, isActive: boolean) {
    setError(null);
    setActiveMutation.mutate({ ruleId: rule.id, isActive }, { onError: (e) => setError(errorText(e)) });
  }

  const columns: TableColumn<TaxRule>[] = [
    { key: 'name', label: 'Tax', render: (r) => r.name, sortValue: (r) => r.name },
    { key: 'amount', label: 'Rate', render: (r) => describeTaxAmount(r, symbol), exportValue: (r) => describeTaxAmount(r, symbol) },
    {
      key: 'type',
      label: 'Type',
      render: (r) => (r.inclusive ? 'Inclusive — inside the price' : 'Exclusive — added on top'),
      exportValue: (r) => (r.inclusive ? 'Inclusive' : 'Exclusive'),
    },
    {
      key: 'appliesTo',
      label: 'Applies to',
      render: (r) => describeAppliesTo(r.appliesToChargeTypes),
      exportValue: (r) => describeAppliesTo(r.appliesToChargeTypes),
    },
  ];
  const activeColumns: TableColumn<TaxRule>[] = canManage
    ? [
        ...columns,
        {
          key: 'action',
          label: 'Action',
          align: 'right',
          render: (r) => (
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="outline" onClick={() => setEditing({ rule: r })}>
                Change
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRetiring(r)}>
                Retire
              </Button>
            </div>
          ),
        },
      ]
    : columns;
  const retiredColumns: TableColumn<TaxRule>[] = canManage
    ? [
        ...columns,
        {
          key: 'action',
          label: 'Action',
          align: 'right',
          render: (r) => (
            <Button size="sm" variant="outline" onClick={() => setActive(r, true)} loading={setActiveMutation.isPending && setActiveMutation.variables?.ruleId === r.id}>
              Reinstate
            </Button>
          ),
        },
      ]
    : columns;

  return (
    <Section label="Tax Rules">
      <div className="flex flex-col gap-3">
        <p className="text-small text-surface">
          The taxes every charge at this branch is billed under, each on its own line of the bill. An exclusive tax is added on top of the price; an inclusive
          one is already inside your prices, so the guest pays the price and the bill shows how much of it was tax. A fixed amount is charged once per charge —
          once a night on room charges.
        </p>
        {canManage ? (
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setEditing({ rule: null })}>
              Add Tax Rule
            </Button>
          </div>
        ) : null}
        {error ? <p className="text-small text-red-600">{error}</p> : null}
        {rulesQuery.isLoading ? (
          <p className="text-body text-surface-muted">Loading tax rules…</p>
        ) : rulesQuery.isError ? (
          <p className="text-small text-red-600">{errorText(rulesQuery.error)}</p>
        ) : (
          <Card tone="secondary">
            <Table columns={activeColumns} rows={active} emptyMessage="No taxes are charged at this branch yet." exportFileName="tax-rules" />
          </Card>
        )}
        {retired.length > 0 ? (
          <div className="flex flex-col gap-2">
            <button type="button" className="self-start text-small font-semibold text-surface underline cursor-pointer" onClick={() => setShowRetired((v) => !v)}>
              {showRetired ? 'Hide' : 'Show'} retired rules ({retired.length})
            </button>
            {showRetired ? (
              <Card tone="secondary">
                <Table columns={retiredColumns} rows={retired} emptyMessage="" />
              </Card>
            ) : null}
          </div>
        ) : null}
        <p className="text-tiny text-surface-muted">
          Changing or retiring a rule applies from the next charge — bills already posted keep the tax they were charged.
        </p>
      </div>

      {editing ? (
        <TaxRuleDialog key={editing.rule?.id ?? 'new'} branchId={branchId} currency={currency} auth={auth} rule={editing.rule} onClose={() => setEditing(null)} />
      ) : null}
      <ConfirmDialog
        open={retiring !== null}
        title={retiring ? `Retire ${retiring.name}?` : ''}
        description="It stops applying to new charges straight away. Bills already posted keep it, and you can reinstate it later."
        confirmLabel="Retire"
        onCancel={() => setRetiring(null)}
        onConfirm={() => {
          if (retiring) setActive(retiring, false);
          setRetiring(null);
        }}
      />
    </Section>
  );
}

function TaxRuleDialog({
  branchId,
  currency,
  auth,
  rule,
  onClose,
}: {
  branchId: string;
  currency: string;
  auth: AuthOpts;
  rule: TaxRule | null;
  onClose: () => void;
}) {
  const createMutation = useCreateTaxRuleMutation(branchId, auth);
  const replaceMutation = useReplaceTaxRuleMutation(branchId, auth);
  const [draft, setDraft] = useState<TaxRuleDraftValues>(() => (rule ? draftFromRule(rule) : emptyTaxRuleDraft()));
  const [attempted, setAttempted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const problem = taxRuleProblem(draft);
  const pending = createMutation.isPending || replaceMutation.isPending;

  async function save() {
    setAttempted(true);
    setError(null);
    if (problem) return;
    try {
      const body = toTaxRuleBody(draft);
      if (rule) await replaceMutation.mutateAsync({ ruleId: rule.id, body });
      else await createMutation.mutateAsync(body);
      onClose();
    } catch (err) {
      setError(errorText(err));
    }
  }

  return (
    <Modal open onClose={onClose} title={rule ? `Change ${rule.name}` : 'Add Tax Rule'}>
      <TaxRuleFields idPrefix="tax-rule" value={draft} onChange={setDraft} currency={currency} />
      {rule ? <p className="text-tiny text-surface-muted">Saving replaces the current rule from the next charge on. Bills already posted keep the old one.</p> : null}
      {attempted && problem ? <p className="text-small text-red-600">{problem}</p> : null}
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={save} loading={pending}>
          {rule ? 'Save Change' : 'Add Tax Rule'}
        </Button>
      </div>
    </Modal>
  );
}
