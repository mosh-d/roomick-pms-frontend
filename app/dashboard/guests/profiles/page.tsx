'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { Table, type TableColumn } from '@/components/ui/Table';
import { GuestProfileIcon } from '@/components/ui/Icons';
import { useGuestsListQuery, type GuestSummary } from '@/lib/guests';
import { useAuthStore } from '@/lib/store/authStore';

/**
 * Guest Profile — the "Guest Profile" card off the Guest Profiles & CRM
 * hub (`/dashboard/guests`). Moved here from `/dashboard/guests` itself so
 * that route could become a genuine hub with its own second card
 * (Corporate Accounts), matching the reference's own "the section's route
 * is a card grid, not a redirect to its first real child" pattern.
 *
 * This is the list half; the profile itself (preferences, VIP, tags,
 * loyalty, stay history, spend summary, notes feed) lives at
 * `/dashboard/guests/[guestId]`.
 */
export default function GuestProfilesListPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 50;

  const guestsQuery = useGuestsListQuery(search, page, auth);
  const totalPages = guestsQuery.data ? Math.max(1, Math.ceil(guestsQuery.data.total / limit)) : 1;

  const columns: TableColumn<GuestSummary>[] = [
    { key: 'name', label: 'Name', render: (g) => g.name, sortValue: (g) => g.name },
    { key: 'email', label: 'Email', render: (g) => g.email ?? '—' },
    { key: 'phone', label: 'Phone', render: (g) => g.phone ?? '—' },
    {
      key: 'action',
      label: 'Action',
      align: 'right',
      render: (g) => (
        <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/guests/${g.id}`)}>
          View Profile
        </Button>
      ),
    },
  ];

  return (
    <Container className="max-w-5xl py-10 flex flex-col gap-6">
      <PageHeader icon={<GuestProfileIcon className="size-8" />} title="Guest Profile" subtitle="Full profile: preferences, history, spend" roles="Front Desk · Manager · CRM" />

      <SearchInput label="Search guests by name or email" placeholder="Search guests" value={search} onChange={(v) => { setSearch(v); setPage(1); }} />

      {guestsQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading guests…</p>
      ) : (
        <>
          <Card tone="secondary">
            <Table columns={columns} rows={guestsQuery.data?.rows ?? []} emptyMessage="No guests match that search." exportFileName="guests" />
          </Card>
          <div className="flex items-center justify-between text-small text-secondary-light">
            <span>
              Page {page} of {totalPages} — {guestsQuery.data?.total ?? 0} total guests
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                Previous
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages}>
                Next
              </Button>
            </div>
          </div>
        </>
      )}
    </Container>
  );
}
