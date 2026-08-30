'use client';

import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { PortfolioOverviewIcon, RevenueManagementIcon, BrandManagementIcon, AddBranchIcon } from '@/components/ui/Icons';
import { HubCard } from '../_components/HubCard';

/**
 * Enterprise / HQ (ref p25) — multi-brand overview, cross-property
 * reporting, centralized brand management. No cross-branch HQ view
 * exists yet, confirmed directly rather than assumed. `RevenueManagementIcon`
 * (a bar chart) is reused for "Cross-Property Reports" rather than adding a
 * near-identical fourth chart glyph — see the icon-reuse discipline note in
 * `roomick_management_admin_sequence`.
 */
export default function EnterpriseHqPage() {
  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader title="Enterprise / HQ View" subtitle="Multi-brand overview, cross-property reporting, centralized brand management." roles="Owner · HQ Admin" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HubCard icon={<PortfolioOverviewIcon className="size-5" />} title="Portfolio Overview" description="All brands and branches at a glance" />
        <HubCard icon={<RevenueManagementIcon className="size-5" />} title="Cross-Property Reports" description="Aggregated reports across all or selected branches" />
        <HubCard icon={<BrandManagementIcon className="size-5" />} title="Brand Management" description="Add/edit brands, manage brand config globally" />
        <HubCard icon={<AddBranchIcon className="size-5" />} title="Add New Branch" description="Onboard a new property to any brand" />
      </div>
    </Container>
  );
}
