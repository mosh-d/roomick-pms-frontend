'use client';

import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { PageHeader } from '@/components/ui/PageHeader';
import { TransferChargesIcon, CreateSecondaryFolioIcon, TransferHistoryIcon } from '@/components/ui/Icons';
import { HubCard } from '../_components/HubCard';

/**
 * Folio Transfer (ref p11) — a real top-level Operations section in its
 * own right, not a child of Billing and Payments. Distinct from Split
 * Billing: this covers mid-stay routing changes — moving an already-posted
 * charge, or everything on a bill, onto a different bill, including
 * another stay's (room to room, guest to company) — not dividing one
 * stay's charges across its own bills.
 */
export default function FolioTransferPage() {
  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader
        title="Folio Transfer"
        subtitle="Move individual charges or entire folio balances between folios mid-stay."
        roles="Front Desk · Accountant"
      />

      <Section label="Folio Transfer">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <HubCard
            icon={<TransferChargesIcon className="size-5" />}
            title="Transfer Charges Between Folios"
            description="Room-to-room, guest-to-corporate, shared room split"
            href="/dashboard/folio-transfer/transfer"
          />
          <HubCard
            icon={<CreateSecondaryFolioIcon className="size-5" />}
            title="Create Secondary Folio"
            description="Guest requests split e.g. personal vs business"
            href="/dashboard/folio-transfer/secondary-folio"
          />
          <HubCard icon={<TransferHistoryIcon className="size-5" />} title="Transfer History" description="Full audit trail of all folio movements" href="/dashboard/folio-transfer/history" />
        </div>
      </Section>
    </Container>
  );
}
