'use client';

import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { TransferChargesIcon, CreateSecondaryFolioIcon, TransferHistoryIcon } from '@/components/ui/Icons';
import { HubCard } from '../_components/HubCard';

/**
 * Folio Transfer (ref p11) — a real top-level Operations section in its
 * own right, not a child of Billing and Payments. Distinct from Split
 * Billing: this covers post-posting corrections and mid-stay routing
 * changes (moving an already-posted charge, or an entire balance, to a
 * different folio), not dividing a single stay's charges across payers at
 * the outset. Nothing behind any of its three cards is built yet.
 */
export default function FolioTransferPage() {
  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader
        title="Folio Transfer"
        subtitle="Move individual charges or entire folio balances between folios mid-stay."
        roles="Front Desk · Accountant"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HubCard icon={<TransferChargesIcon className="size-5" />} title="Transfer Charges Between Folios" description="Room-to-room, guest-to-corporate, shared room split" />
        <HubCard icon={<CreateSecondaryFolioIcon className="size-5" />} title="Create Secondary Folio" description="Guest requests split e.g. personal vs business" />
        <HubCard icon={<TransferHistoryIcon className="size-5" />} title="Transfer History" description="Full audit trail of all folio movements" />
      </div>
    </Container>
  );
}
