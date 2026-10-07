'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, type SelectOption } from '@/components/ui/Select';
import { Modal } from '@/components/ui/Modal';
import { MultiSelectTagInput } from '@/components/ui/MultiSelectTagInput';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, type TableColumn } from '@/components/ui/Table';
import { CorporateAccountsIcon } from '@/components/ui/Icons';
import {
  useCorporateAccountQuery,
  useCorporateAccountsQuery,
  useSaveCorporateAccountMutation,
  type CorporateAccount,
  type CorporateStay,
  type CorporateTraveler,
} from '@/lib/corporateAccounts';
import { useRatePlansQuery } from '@/lib/rate-resolver';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { isSupervisorAtBranch } from '@/lib/roles';
import { ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/store/authStore';

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

function contractLabel(account: CorporateAccount): string {
  if (!account.ratePlan) return 'No contracted rate';
  const symbol = currencySymbolFor(account.ratePlan.branch.currency);
  return `${account.ratePlan.name} — ${formatMoney(account.ratePlan.amount, symbol)} a night at ${account.ratePlan.branch.name}${account.ratePlan.isActive ? '' : ' (plan switched off)'}`;
}

/**
 * Corporate Accounts — the second card on Guest Profiles & CRM (Month 9:
 * "a corporate account with a contracted rate plan correctly resolves
 * through the Rate Resolver for a linked traveler's booking").
 *
 * A company's people are booked under it from Walk-In Booking or Create
 * Reservation — picked from the list, or offered automatically when the
 * guest's email is on one of the company's domains. The contracted rate is a
 * negotiated rate plan (set up in Rate Resolver); travelers are everyone who
 * has stayed under the account.
 */
export default function CorporateAccountsPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const accountsQuery = useCorporateAccountsQuery(auth);
  const saveMutation = useSaveCorporateAccountMutation(auth);
  const [editing, setEditing] = useState<{ account: CorporateAccount | null } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!activeBranchId) return null;
  const canManage = isSupervisorAtBranch(user, activeBranchId);
  const accounts = accountsQuery.data ?? [];

  const columns: TableColumn<CorporateAccount>[] = [
    {
      key: 'name',
      label: 'Company',
      render: (a) => (
        <button type="button" className="text-left font-semibold underline underline-offset-2 cursor-pointer" onClick={() => setOpenId(a.id)}>
          {a.name}
        </button>
      ),
      sortValue: (a) => a.name,
    },
    { key: 'domains', label: 'Email domains', render: (a) => (a.emailDomains.length ? a.emailDomains.join(', ') : '—'), exportValue: (a) => a.emailDomains.join(' ') },
    { key: 'contract', label: 'Contracted rate', render: (a) => contractLabel(a), exportValue: (a) => contractLabel(a) },
    { key: 'stays', label: 'Stays', align: 'right', render: (a) => a._count.reservations, sortValue: (a) => a._count.reservations },
    { key: 'status', label: 'Status', render: (a) => (a.isActive ? 'Active' : 'Switched off'), sortValue: (a) => (a.isActive ? 0 : 1) },
    ...(canManage
      ? [
          {
            key: 'action',
            label: 'Action',
            align: 'right' as const,
            render: (a: CorporateAccount) => (
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditing({ account: a })}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setError(null);
                    saveMutation.mutate(
                      { accountId: a.id, body: { isActive: !a.isActive } },
                      { onError: (err) => setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.') },
                    );
                  }}
                >
                  {a.isActive ? 'Switch Off' : 'Switch On'}
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ];

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader
        icon={<CorporateAccountsIcon className="size-8" />}
        title="Corporate Accounts"
        subtitle="Company profiles with linked travelers and their contracted rates."
        roles="Front Desk · Manager · CRM"
        actions={
          canManage ? (
            <Button type="button" onClick={() => setEditing({ account: null })}>
              Add Company
            </Button>
          ) : undefined
        }
      />

      <Section label="Companies">
        <p className="text-small text-primary-dark/75">
          Book a company&apos;s people under it from Walk-In Booking or Create Reservation — it&apos;s offered automatically when the guest&apos;s email is on one of
          the company&apos;s domains. A contracted rate is a negotiated rate plan from Rate Resolver; a company with none still gets any corporate discount a
          property runs.
        </p>
        {error ? <p className="text-small text-red-600">{error}</p> : null}
        {accountsQuery.isLoading ? (
          <p className="text-body text-primary-dark/70">Loading companies…</p>
        ) : (
          <Card tone="secondary">
            <Table columns={columns} rows={accounts} emptyMessage="No company accounts yet." exportFileName="corporate-accounts" />
          </Card>
        )}
      </Section>

      {openId ? <AccountDetail accountId={openId} auth={auth} onClose={() => setOpenId(null)} /> : null}
      {editing ? <AccountDialog key={editing.account?.id ?? 'new'} account={editing.account} branchId={activeBranchId} auth={auth} onClose={() => setEditing(null)} /> : null}
    </Container>
  );
}

function AccountDetail({ accountId, auth, onClose }: { accountId: string; auth: AuthOpts; onClose: () => void }) {
  const detailQuery = useCorporateAccountQuery(accountId, auth);
  const detail = detailQuery.data;

  const travelerColumns: TableColumn<CorporateTraveler & { id: string }>[] = [
    {
      key: 'name',
      label: 'Traveler',
      render: (t) => (
        <Link href={`/dashboard/guests/${t.guest.id}`} className="underline underline-offset-2">
          {t.guest.name}
        </Link>
      ),
      sortValue: (t) => t.guest.name,
    },
    { key: 'contact', label: 'Contact', render: (t) => [t.guest.email, t.guest.phone].filter(Boolean).join(' · ') || '—' },
    { key: 'stays', label: 'Stays', align: 'right', render: (t) => t.stays, sortValue: (t) => t.stays },
    { key: 'last', label: 'Last stay', render: (t) => new Date(t.lastStay).toLocaleDateString(), sortValue: (t) => t.lastStay },
  ];
  const stayColumns: TableColumn<CorporateStay>[] = [
    { key: 'conf', label: 'Confirmation #', render: (s) => s.confirmationNumber, sortValue: (s) => s.confirmationNumber },
    { key: 'guest', label: 'Guest', render: (s) => s.guest.name, sortValue: (s) => s.guest.name },
    { key: 'branch', label: 'Property', render: (s) => s.branch.name },
    { key: 'dates', label: 'Dates', render: (s) => `${new Date(s.checkInDate).toLocaleDateString()} – ${new Date(s.checkOutDate).toLocaleDateString()}`, sortValue: (s) => s.checkInDate },
    { key: 'status', label: 'Status', render: (s) => s.status.replace('_', ' ') },
    { key: 'rate', label: 'Room total', align: 'right', render: (s) => formatMoney(s.confirmedRate, currencySymbolFor(s.branch.currency)) },
  ];

  return (
    <Section label={detail ? detail.name : 'Company'}>
      {detailQuery.isLoading || !detail ? (
        <p className="text-body text-primary-dark/70">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-col gap-1 text-small text-primary-dark">
              <p>
                <span className="font-semibold">Contracted rate:</span> {contractLabel(detail)}
              </p>
              <p>
                <span className="font-semibold">Contact:</span> {[detail.contactName, detail.contactEmail].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
          <Card tone="secondary">
            <p className="text-small font-bold text-secondary mb-2">Travelers</p>
            <Table columns={travelerColumns} rows={detail.travelers.map((t) => ({ ...t, id: t.guest.id }))} emptyMessage="Nobody has stayed under this company yet." />
          </Card>
          <Card tone="secondary">
            <p className="text-small font-bold text-secondary mb-2">Latest stays</p>
            <Table columns={stayColumns} rows={detail.recentStays} emptyMessage="No stays yet." />
          </Card>
        </div>
      )}
    </Section>
  );
}

function AccountDialog({ account, branchId, auth, onClose }: { account: CorporateAccount | null; branchId: string; auth: AuthOpts; onClose: () => void }) {
  const saveMutation = useSaveCorporateAccountMutation(auth);
  const plansQuery = useRatePlansQuery(branchId, auth);
  const [name, setName] = useState(account?.name ?? '');
  const [domains, setDomains] = useState<string[]>(account?.emailDomains ?? []);
  const [ratePlanId, setRatePlanId] = useState<string | null>(account?.ratePlanId ?? null);
  const [contactName, setContactName] = useState(account?.contactName ?? '');
  const [contactEmail, setContactEmail] = useState(account?.contactEmail ?? '');
  const [error, setError] = useState<string | null>(null);

  // Negotiated plans at this property, plus the account's current contract
  // if it's at another one — so editing doesn't silently drop it.
  const planOptions: SelectOption[] = [
    { value: '', label: 'No contracted rate' },
    ...(plansQuery.data ?? []).filter((p) => p.type === 'negotiated' && p.isActive).map((p) => ({ value: p.id, label: `${p.name} — ${p.amount} a night` })),
    ...(account?.ratePlan && account.ratePlan.branchId !== branchId ? [{ value: account.ratePlan.id, label: `${account.ratePlan.name} (at ${account.ratePlan.branch.name})` }] : []),
  ];

  async function save() {
    setError(null);
    if (!name.trim()) {
      setError('Give the company a name');
      return;
    }
    try {
      await saveMutation.mutateAsync({
        accountId: account?.id ?? null,
        body: { name: name.trim(), emailDomains: domains, ratePlanId, contactName: contactName.trim(), contactEmail: contactEmail.trim() || undefined },
      });
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');
    }
  }

  return (
    <Modal open onClose={onClose} title={account ? `Edit ${account.name}` : 'Add Company'}>
      <Input id="corporate-name" label="Company name" value={name} onChange={(e) => setName(e.target.value)} maxLength={200} />
      <MultiSelectTagInput
        id="corporate-domains"
        label="Staff email domains"
        options={[]}
        value={domains}
        onChange={setDomains}
        allowCustom
        formatTag={(raw) => raw.trim().toLowerCase().replace(/^@+/, '')}
        hint="Like dangote.com — a guest booked with an address there is offered this company's rate."
      />
      <Select
        id="corporate-rate-plan"
        label="Contracted rate"
        options={planOptions}
        value={ratePlanId ?? ''}
        onChange={(v) => setRatePlanId(v || null)}
        hint="A negotiated rate plan, set up in Rate Resolver. It applies at the property the plan belongs to."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
        <Input id="corporate-contact-name" label="Contact name (optional)" value={contactName} onChange={(e) => setContactName(e.target.value)} maxLength={200} />
        <Input id="corporate-contact-email" label="Contact email (optional)" type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} maxLength={320} />
      </div>
      {error ? <p className="text-small text-red-600">{error}</p> : null}
      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="button" onClick={save} loading={saveMutation.isPending}>
          {account ? 'Save Changes' : 'Add Company'}
        </Button>
      </div>
    </Modal>
  );
}
