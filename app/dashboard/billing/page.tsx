'use client';

import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { ReceiptIcon, SplitBillingIcon, NightAuditIcon, RefundsIcon } from '@/components/ui/Icons';
import { useFoliosQuery } from '@/lib/folios';
import { useAuthStore } from '@/lib/store/authStore';
import { HubCard } from '../_components/HubCard';

/**
 * Billing and Payments hub (ref p9) — exactly four cards: Guest Folio,
 * Split Billing, Night Audit, Refunds and Corrections. Folio Transfer,
 * Point of Sale, Shift Management, No-Show Handling, Guest Registration
 * Card, and Comms Log used to live here too — the reference draws those
 * six as independent top-level Operations sections in their own right
 * (`Sidebar.tsx`), not children of Billing and Payments, so they moved
 * out to their own routes.
 */
export default function BillingHubPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const outstandingQuery = useFoliosQuery(activeBranchId, 'outstanding', auth);

  if (!activeBranchId) return null;

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader
        title="Billing and Payments"
        subtitle="Folios, charges, payments, split billing, invoices, night audit."
        roles="Front Desk · Accountant · Manager"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HubCard
          icon={<ReceiptIcon className="size-5" />}
          title="Guest Folio"
          description="Live charges, line items, running balance"
          stats={outstandingQuery.data ? [`${outstandingQuery.data.length} outstanding ${outstandingQuery.data.length === 1 ? 'folio' : 'folios'}`] : undefined}
          href="/dashboard/billing/folios"
        />
        <HubCard icon={<SplitBillingIcon className="size-5" />} title="Split Billing" description="Divide charges across multiple folios" href="/dashboard/split-billing" />
        <HubCard icon={<NightAuditIcon className="size-5" />} title="Night Audit" description="End-of-day rollover and reconciliation" href="/dashboard/night-audit" />
        <HubCard icon={<RefundsIcon className="size-5" />} title="Refunds & Corrections" description="Process refunds with approval workflow" />
      </div>
    </Container>
  );
}
