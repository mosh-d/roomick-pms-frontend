'use client';

import { useRouter } from 'next/navigation';
import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/PageHeader';
import { Table, type TableColumn } from '@/components/ui/Table';
import { LoyaltyProgramConfigIcon, EmailCampaignIcon } from '@/components/ui/Icons';
import { useLoyaltySummaryQuery, type LoyaltyMember } from '@/lib/loyalty';
import { useAuthStore } from '@/lib/store/authStore';
import { HubCard } from '../_components/HubCard';

/**
 * Loyalty & Marketing (ref p21) — scoped from the start of this Management/
 * Admin sequence as a "display-only slice" (see the sequence's own memory
 * note): `GuestProfile.loyaltyTier`/`loyaltyPoints` have existed since
 * Guest Profiles & CRM, editable per-guest, but nothing anywhere surfaced
 * them in aggregate until now. This is that aggregate view — every guest
 * with a tier or points, grouped by tier — NOT a points-earning engine,
 * NOT tier-benefit rules, NOT a campaign sender. Loyalty Program Config and
 * Email Campaign Builder stay honest inert cards: `loyaltyTier` is a plain
 * free-text column, not a foreign key into a real tiers table, and no
 * bulk-marketing infrastructure exists anywhere in this app (`CommsLogService`
 * only sends per-reservation transactional messages).
 */
export default function LoyaltyMarketingPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const summaryQuery = useLoyaltySummaryQuery(auth);
  const summary = summaryQuery.data;

  const columns: TableColumn<LoyaltyMember>[] = [
    { key: 'name', label: 'Guest', render: (m) => m.name, sortValue: (m) => m.name },
    { key: 'email', label: 'Email', render: (m) => m.email ?? '—' },
    { key: 'tier', label: 'Tier', render: (m) => m.loyaltyTier, sortValue: (m) => m.loyaltyTier },
    { key: 'points', label: 'Points', align: 'right', render: (m) => m.loyaltyPoints.toLocaleString(), sortValue: (m) => m.loyaltyPoints },
    {
      key: 'action',
      label: 'Action',
      align: 'right',
      render: (m) => (
        <Button size="sm" variant="outline" onClick={() => router.push(`/dashboard/guests/${m.id}`)}>
          View Profile
        </Button>
      ),
    },
  ];

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader title="Loyalty & Marketing" subtitle="Points, tiers, campaigns, promo codes, push notifications." roles="Marketing · Manager" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HubCard icon={<LoyaltyProgramConfigIcon className="size-5" />} title="Loyalty Program Config" description="Points rules, tiers, benefits" />
        <HubCard icon={<EmailCampaignIcon className="size-5" />} title="Email Campaign Builder" description="Template, segment, schedule, A/B test" />
      </div>

      <Section label="Loyalty Members">
        {summaryQuery.isLoading || !summary ? (
          <p className="text-body text-primary-dark/70">Loading…</p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-4">
              <Card tone="accent" className="flex-1 min-w-40">
                <p className="text-tiny text-primary-dark/70">Total Members</p>
                <p className="text-header font-bold text-primary-dark">{summary.totalMembers}</p>
              </Card>
              <Card tone="accent" className="flex-1 min-w-40">
                <p className="text-tiny text-primary-dark/70">Total Points Issued</p>
                <p className="text-header font-bold text-primary-dark">{summary.totalPointsIssued.toLocaleString()}</p>
              </Card>
              {summary.byTier.map((t) => (
                <Card key={t.tier} tone="accent" className="flex-1 min-w-40">
                  <p className="text-tiny text-primary-dark/70">{t.tier}</p>
                  <p className="text-header font-bold text-primary-dark">{t.memberCount}</p>
                  <p className="text-tiny text-primary-dark/60">{t.totalPoints.toLocaleString()} pts</p>
                </Card>
              ))}
            </div>

            {summary.members.length === 0 ? (
              <p className="text-body text-primary-dark/70">No guest has a loyalty tier or points on file yet — set them from a guest&rsquo;s own profile.</p>
            ) : (
              <Card tone="secondary">
                <Table columns={columns} rows={summary.members} emptyMessage="No loyalty members yet." exportFileName="loyalty-members" />
              </Card>
            )}
          </div>
        )}
      </Section>
    </Container>
  );
}
