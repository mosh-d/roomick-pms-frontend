'use client';

import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoyaltyProgramConfigIcon, EmailCampaignIcon } from '@/components/ui/Icons';
import { HubCard } from '../_components/HubCard';

/**
 * Loyalty & Marketing (ref p21) — one of the architecture map's own named
 * gaps (`page-loyalty`): points, tiers, campaigns, promo codes, push
 * notifications. `GuestProfile.loyaltyTier`/`loyaltyPoints` already exist
 * as plain fields on the guest record (editable from Guest Profiles &
 * CRM) — this page is the missing PROGRAM-level configuration and
 * campaign tooling around them, not yet built.
 */
export default function LoyaltyMarketingPage() {
  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader title="Loyalty & Marketing" subtitle="Points, tiers, campaigns, promo codes, push notifications." roles="Marketing · Manager" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HubCard icon={<LoyaltyProgramConfigIcon className="size-5" />} title="Loyalty Program Config" description="Points rules, tiers, benefits" />
        <HubCard icon={<EmailCampaignIcon className="size-5" />} title="Email Campaign Builder" description="Template, segment, schedule, A/B test" />
      </div>
    </Container>
  );
}
