'use client';

import { useState } from 'react';
import { Select, type SelectOption } from '@/components/ui/Select';
import { accountForEmail, useCorporateAccountsQuery, type CorporateAccount } from '@/lib/corporateAccounts';

/**
 * Which company a booking is made under. Untouched, it follows the guest's
 * email — an address on one of a company's domains offers that company —
 * and picking "None" or another company overrides that for good. Derived,
 * not synced in an effect: the effective company is worked out each render.
 */
export function useCompanyChoice(email: string | undefined, auth: { accessToken: string | undefined; tenantId: string | undefined }) {
  const accountsQuery = useCorporateAccountsQuery(auth);
  const [choice, setChoice] = useState<string | null | undefined>(undefined);
  const accounts = (accountsQuery.data ?? []).filter((account) => account.isActive);
  const suggested = accountForEmail(accounts, email);
  const companyId = choice === undefined ? (suggested?.id ?? null) : choice;
  return { accounts, companyId, suggested: choice === undefined ? suggested : null, setChoice };
}

export function CompanyField({
  accounts,
  companyId,
  suggested,
  onChange,
}: {
  accounts: CorporateAccount[];
  companyId: string | null;
  suggested: CorporateAccount | null;
  onChange: (companyId: string | null) => void;
}) {
  // No companies set up: nothing to choose, so no field.
  if (accounts.length === 0) return null;
  const options: SelectOption[] = [{ value: '', label: 'None — public rates' }, ...accounts.map((account) => ({ value: account.id, label: account.name }))];
  return (
    <div className="flex flex-col gap-1">
      <Select
        id="corporateAccountId"
        label="Company (optional)"
        options={options}
        value={companyId ?? ''}
        onChange={(value) => onChange(value || null)}
        hint="Books the stay under the company, at its contracted rate."
      />
      {suggested ? <p className="text-tiny text-primary-dark/70">Offered because the guest&apos;s email is on one of {suggested.name}&apos;s domains.</p> : null}
    </div>
  );
}
