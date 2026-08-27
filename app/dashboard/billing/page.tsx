'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { ReceiptIcon } from '@/components/ui/Icons';
import { Table, type TableColumn } from '@/components/ui/Table';
import { useFoliosQuery, type FolioListRow, type FolioFilter } from '@/lib/folios';
import { formatMoney } from '@/lib/numberFormat';
import { currencySymbolFor } from '@/lib/currencies';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * Billing and Payments index (the reference's Guest Folio search, realised
 * as a list — ref p33 opens with "Search by guest name").
 *
 * The three tabs use the in-house PMS's own vocabulary
 * (`docs/PMS-OPERATIONS-GUIDE.md`): **Outstanding** = open with a balance
 * owed; **Overdue** = owing *and* the check-out date has already passed,
 * i.e. a City Ledger receivable. Filtering happens server-side so the
 * definitions live in one place.
 */
const TABS: { value: FolioFilter; label: string }[] = [
  { value: 'outstanding', label: 'Outstanding' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'all', label: 'All' },
];

export default function BillingIndexPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const [filter, setFilter] = useState<FolioFilter>('outstanding');
  const [search, setSearch] = useState('');

  const foliosQuery = useFoliosQuery(activeBranchId, filter, { accessToken: accessToken ?? undefined, tenantId: user?.tenantId });

  const rows = useMemo(() => {
    const all = foliosQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (f) =>
        f.guest.name.toLowerCase().includes(q) ||
        (f.reservation?.confirmationNumber ?? '').toLowerCase().includes(q) ||
        (f.reservation?.room?.number ?? '').toLowerCase().includes(q),
    );
  }, [foliosQuery.data, search]);

  if (!activeBranchId) return null;

  const columns: TableColumn<FolioListRow>[] = [
    { key: 'guest', label: 'Guest', render: (f) => f.guest.name, sortValue: (f) => f.guest.name },
    { key: 'room', label: 'Room', render: (f) => f.reservation?.room?.number ?? '—', sortValue: (f) => f.reservation?.room?.number ?? '' },
    {
      key: 'confirmation',
      label: 'Confirmation #',
      render: (f) => f.reservation?.confirmationNumber ?? '—',
      sortValue: (f) => f.reservation?.confirmationNumber ?? '',
    },
    {
      key: 'guestStatus',
      label: 'Guest Status',
      render: (f) => <GuestStatusBadge status={f.guestStatus} />,
      sortValue: (f) => f.guestStatus ?? '',
    },
    {
      key: 'balance',
      label: 'Balance',
      align: 'right',
      render: (f) => <BalanceCell amount={f.balanceDue} currency={f.currency} />,
      sortValue: (f) => Number(f.balanceDue),
      exportValue: (f) => f.balanceDue,
    },
    {
      key: 'action',
      label: 'Action',
      align: 'right',
      render: (f) => (
        <Button size="sm" onClick={() => router.push(`/dashboard/billing/${f.id}`)}>
          View Folio
        </Button>
      ),
    },
  ];

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-6">
      <PageHeader icon={<ReceiptIcon className="size-8" />} title="Guest Folio" subtitle="Live charges, line items, running balance" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex rounded-control border border-accent/30 p-1 gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => setFilter(tab.value)}
              className={`rounded-control px-3 py-1.5 text-small font-semibold cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                filter === tab.value ? 'bg-primary text-white' : 'text-secondary hover:bg-accent/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <SearchInput label="Search folios by guest name" placeholder="Search by guest name" value={search} onChange={setSearch} />
      </div>

      {foliosQuery.isLoading ? (
        <p className="text-body text-secondary-light">Loading folios…</p>
      ) : foliosQuery.isError ? (
        <p className="text-body text-red-600">Could not load folios. Please try refreshing.</p>
      ) : (
        <Card tone="secondary">
          <Table
            columns={columns}
            rows={rows}
            emptyMessage={search ? 'No folios match that search.' : `No ${filter === 'all' ? '' : filter + ' '}folios right now.`}
            exportFileName={`folios-${filter}`}
          />
        </Card>
      )}
    </Container>
  );
}

/** City Ledger = departed and still owing (collections). Still In-House = owing but the guest is here, so front desk can resolve it before departure. */
function GuestStatusBadge({ status }: { status: FolioListRow['guestStatus'] }) {
  if (status === 'city_ledger') {
    return <span className="inline-flex rounded-pill bg-status-out-of-order px-3 py-1 text-tiny font-semibold text-white">City Ledger</span>;
  }
  if (status === 'in_house') {
    return <span className="inline-flex rounded-pill bg-status-occupied px-3 py-1 text-tiny font-semibold text-white">Still In-House</span>;
  }
  return <span className="text-secondary-light">—</span>;
}

/** Positive = owed by the guest (red). Negative = a credit owed back to them (green), matching the in-house PMS's own convention. */
function BalanceCell({ amount, currency }: { amount: string; currency: string }) {
  const symbol = currencySymbolFor(currency);
  const numeric = Number(amount);
  if (numeric < 0) return <span className="font-semibold text-green-700">Credit {formatMoney(Math.abs(numeric), symbol)}</span>;
  if (numeric > 0) return <span className="font-semibold text-red-600">{formatMoney(amount, symbol)}</span>;
  return <span className="text-secondary-light">{formatMoney(amount, symbol)}</span>;
}
