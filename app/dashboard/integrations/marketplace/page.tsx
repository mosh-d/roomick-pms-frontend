'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { BackButton } from '@/components/ui/BackButton';
import { SearchInput } from '@/components/ui/SearchInput';
import { IntegrationsIcon } from '@/components/ui/Icons';
import { ApiError } from '@/lib/api';
import { listingState, useMarketplaceQuery, type MarketplaceListing } from '@/lib/marketplace';
import { useAuthStore } from '@/lib/store/authStore';
import { ListingStateBadge } from './_components/marketplaceUi';

/**
 * Integrations Marketplace (growth plan, Month 11): browse by category and
 * switch an integration on without a developer. Every "Available" listing
 * works end to end; the rest say what they're waiting on rather than showing
 * a button that does nothing.
 */
export default function MarketplacePage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };
  const marketplace = useMarketplaceQuery(auth);
  const [category, setCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (marketplace.data?.listings ?? []).filter(
      (listing) =>
        (!category || listing.category === category) &&
        (!term || `${listing.name} ${listing.vendor} ${listing.summary} ${listing.categoryLabel}`.toLowerCase().includes(term)),
    );
  }, [marketplace.data, category, search]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const listing of marketplace.data?.listings ?? []) map.set(listing.category, (map.get(listing.category) ?? 0) + 1);
    return map;
  }, [marketplace.data]);

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-6">
      <BackButton fallbackHref="/dashboard/integrations" />
      <PageHeader
        icon={<IntegrationsIcon className="size-6" />}
        title="Integrations Marketplace"
        subtitle="Connect Roomick to the other tools your property runs on."
        roles="Owner · Manager · Accountant"
      />

      <div className="flex flex-col gap-3">
        <div className="max-w-md">
          <SearchInput label="Search integrations" value={search} onChange={setSearch} placeholder="Search integrations" />
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          <CategoryChip label={`All (${marketplace.data?.listings.length ?? 0})`} active={category === null} onClick={() => setCategory(null)} />
          {(marketplace.data?.categories ?? []).map((c) => (
            <CategoryChip key={c.key} label={`${c.label} (${counts.get(c.key) ?? 0})`} active={category === c.key} onClick={() => setCategory(c.key)} />
          ))}
        </div>
      </div>

      {marketplace.isError ? (
        <p className="text-small text-red-600">{marketplace.error instanceof ApiError ? marketplace.error.message : 'Couldn’t load the marketplace.'}</p>
      ) : marketplace.isLoading ? (
        <p className="text-small text-secondary">Loading…</p>
      ) : visible.length === 0 ? (
        <p className="text-small text-secondary">Nothing matches that.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="marketplace-listings">
          {visible.map((listing) => (
            <ListingCard key={listing.key} listing={listing} />
          ))}
        </div>
      )}
    </Container>
  );
}

function CategoryChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-small ${active ? 'border-secondary bg-secondary text-white' : 'border-secondary/30 text-secondary hover:bg-secondary/10'}`}
    >
      {label}
    </button>
  );
}

function ListingCard({ listing }: { listing: MarketplaceListing }) {
  const state = listingState(listing);
  return (
    <Link href={`/dashboard/integrations/marketplace/${listing.key}`} className="block rounded-card focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary">
      <Card className={`h-full flex flex-col gap-2 hover:border-secondary/50 ${state === 'coming_later' ? 'opacity-80' : ''}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-body font-semibold text-secondary">{listing.name}</p>
            <p className="text-tiny text-secondary/70">
              {listing.categoryLabel} · {listing.vendor}
            </p>
          </div>
          <ListingStateBadge state={state} />
        </div>
        <p className="text-small text-secondary">{listing.summary}</p>
        {state === 'coming_later' && listing.waitingOn ? <p className="text-tiny text-secondary/70">Waiting on: {listing.waitingOn}</p> : null}
        {state === 'on' && listing.connection?.lastRunSummary ? <p className="text-tiny text-green-800">{listing.connection.lastRunSummary}</p> : null}
      </Card>
    </Link>
  );
}
