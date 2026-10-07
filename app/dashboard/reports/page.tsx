'use client';

import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReportsIcon, FinancialReportsIcon, CustomReportBuilderIcon } from '@/components/ui/Icons';
import { HubCard } from '../_components/HubCard';

/**
 * Reports & Analytics hub (ref p20) — Operational Reports (occupancy, ADR,
 * RevPAR, revenue), Financial Reports (revenue by department, tax, cash
 * flow, export to the accountant) and the Custom Report Builder.
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

      <Section label="Reports & Analytics">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <HubCard icon={<ReportsIcon className="size-5" />} title="Operational Reports" description="Occupancy, ADR, RevPAR, no-shows, cancellations" href="/dashboard/reports/operational" />
          <HubCard icon={<FinancialReportsIcon className="size-5" />} title="Financial Reports" description="Daily revenue, tax, cash flow, monthly summary" href="/dashboard/reports/financial" />
          <HubCard icon={<CustomReportBuilderIcon className="size-5" />} title="Custom Report Builder" description="Select fields, filters, groupings, save templates" href="/dashboard/reports/custom" />
        </div>
      </Section>
    </Container>
  );
}
