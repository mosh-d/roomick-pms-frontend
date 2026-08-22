'use client';

import { Section } from '@/components/ui/Section';
import { Button } from '@/components/ui/Button';

export type ReviewSummary = {
  subdomain: string;
  brandMode: 'single' | 'multi';
  branchName: string;
  branchCategory?: string;
  currency: string;
  timezone: string;
  roomTypeName: string;
  baseRate: string;
  roomCount: number;
};

/**
 * Onboarding step 5 (Roomick-UI.pdf "Review") — read-only recap of
 * everything the wizard just created, before handing off. Uses `Section`
 * (not `Card`) throughout: its own header comment documents `primary-light`
 * as reserved for "whole-page review/summary wrappers" specifically, so
 * this is the one screen in the wizard that's visually distinct from the
 * secondary-tinted forms before it.
 */
export function ReviewStep({ summary, onFinish }: { summary: ReviewSummary; onFinish: () => void }) {
  return (
    <div className="flex flex-col gap-4">
      <Section label="Organization">
        <Row label="Subdomain" value={summary.subdomain} />
        <Row label="Structure" value={summary.brandMode === 'single' ? 'Single-Brand' : 'Multi-Brand'} />
      </Section>

      <Section label="Branch">
        <Row label="Name" value={summary.branchName} />
        {summary.branchCategory ? <Row label="Category" value={summary.branchCategory} /> : null}
        <Row label="Currency" value={summary.currency} />
        <Row label="Timezone" value={summary.timezone} />
      </Section>

      <Section label="Rooms">
        <Row label="Room Type" value={summary.roomTypeName} />
        <Row label="Base Rate" value={`${summary.currency} ${summary.baseRate}`} />
        <Row label="Rooms Created" value={String(summary.roomCount)} />
      </Section>

      <Button type="button" onClick={onFinish}>
        Finish
      </Button>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-small text-secondary-light">{label}</span>
      <span className="text-body font-semibold text-secondary">{value}</span>
    </div>
  );
}
