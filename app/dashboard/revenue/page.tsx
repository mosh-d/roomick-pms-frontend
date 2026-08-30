'use client';

import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { DemandForecastIcon, RateRecommendationsIcon, RestrictionsManagementIcon, CompSetAnalysisIcon } from '@/components/ui/Icons';
import { HubCard } from '../_components/HubCard';

/**
 * Revenue Management (ref p18) — one of the architecture map's own named
 * gaps (`page-rms`), a full endpoint/UI spec written but never built.
 * Distinct from Rate Resolver (the always-on pricing engine every booking
 * screen calls) and Overbooking Management (already real): this is the
 * strategic, forward-looking layer — demand forecasting, AI-suggested
 * rates, and competitor tracking — none of which has a backend module
 * registered yet.
 */
export default function RevenueManagementPage() {
  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader
        title="Revenue Management"
        subtitle="Demand forecasting, yield management, rate optimization, comp set analysis."
        roles="Revenue Manager"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HubCard icon={<DemandForecastIcon className="size-5" />} title="Demand Forecast" description="AI-based occupancy prediction by date" />
        <HubCard icon={<RateRecommendationsIcon className="size-5" />} title="Rate Recommendations" description="AI-suggested rates with approval workflow" />
        <HubCard icon={<RestrictionsManagementIcon className="size-5" />} title="Restrictions Management" description="MinLOS, CTA, MaxLOS, stop-sell" />
        <HubCard icon={<CompSetAnalysisIcon className="size-5" />} title="Comp Set Analysis" description="Competitor rates, parity alerts" />
      </div>
    </Container>
  );
}
