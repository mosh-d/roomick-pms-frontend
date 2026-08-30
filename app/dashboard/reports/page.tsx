'use client';

import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReportsIcon, FinancialReportsIcon, CustomReportBuilderIcon } from '@/components/ui/Icons';
import { HubCard } from '../_components/HubCard';

/**
 * Reports & Analytics hub (ref p20) — used to jump straight to Operational
 * Reports, the only one of its three cards that's real, unlike Front Desk/
 * Reservations/Housekeeping/Billing. Moved that content to
 * `/dashboard/reports/operational` so this route could become a genuine
 * card grid. Financial Reports (tax summary, cash-flow waterfall) and the
 * Custom Report Builder are the reference's own later-phase scalability
 * hooks (BI exports, scheduled reports) — explicitly beyond MVP.
 */
export default function ReportsHubPage() {
  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader
        icon={<ReportsIcon className="size-8" />}
        title="Reports & Analytics"
        subtitle="Occupancy, ADR, RevPAR, financials, custom reports, BI exports."
        roles="Manager · Owner · Accountant"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HubCard icon={<ReportsIcon className="size-5" />} title="Operational Reports" description="Occupancy, ADR, RevPAR, no-shows, cancellations" href="/dashboard/reports/operational" />
        <HubCard icon={<FinancialReportsIcon className="size-5" />} title="Financial Reports" description="Daily revenue, tax, cash flow, monthly summary" />
        <HubCard icon={<CustomReportBuilderIcon className="size-5" />} title="Custom Report Builder" description="Select fields, filters, groupings, save templates" />
      </div>
    </Container>
  );
}
