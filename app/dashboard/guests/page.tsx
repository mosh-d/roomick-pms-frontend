'use client';

import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { GuestProfileIcon, CorporateAccountsIcon } from '@/components/ui/Icons';
import { useGuestsListQuery } from '@/lib/guests';
import { useAuthStore } from '@/lib/store/authStore';
import { HubCard } from '../_components/HubCard';

/**
 * Guest Profiles & CRM hub (ref p13) — used to jump straight to the guest
 * list, unlike Front Desk/Reservations/Housekeeping/Billing. The list
 * moved to `/dashboard/guests/profiles`; Corporate Accounts is a real,
 * named gap (`POST /corporate-accounts` was never implemented despite the
 * table existing since P0) — substantial enough on its own to be a future
 * pass, not folded into this one.
 */
export default function GuestCrmHubPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const guestsQuery = useGuestsListQuery('', 1, auth);

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader
        icon={<GuestProfileIcon className="size-8" />}
        title="Guest Profiles & CRM"
        subtitle="Guest history, preferences, corporate accounts, VIP tagging, spend analytics."
        roles="Front Desk · Manager · CRM"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HubCard
          icon={<GuestProfileIcon className="size-5" />}
          title="Guest Profile"
          description="Full profile: preferences, history, spend"
          stats={guestsQuery.data ? [`${guestsQuery.data.total} ${guestsQuery.data.total === 1 ? 'guest' : 'guests'} on file`] : undefined}
          href="/dashboard/guests/profiles"
        />
        <HubCard icon={<CorporateAccountsIcon className="size-5" />} title="Corporate Accounts" description="Company profiles with linked travelers" />
      </div>
    </Container>
  );
}
