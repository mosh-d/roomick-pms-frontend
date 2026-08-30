'use client';

import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { PosTerminalIcon, MenuManagementIcon } from '@/components/ui/Icons';
import { HubCard } from '../_components/HubCard';

/**
 * Point of Sale (ref p12) — internal POS for hotel outlets (restaurant,
 * bar, spa, laundry, room service), posting straight to a guest's folio.
 * A real top-level Operations section in its own right. Nothing built
 * behind either card yet.
 */
export default function PointOfSalePage() {
  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader
        title="Point of Sale"
        subtitle="Internal POS for all hotel outlets — restaurant, bar, spa, laundry, room service."
        roles="F&B Staff · Spa · Laundry"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HubCard icon={<PosTerminalIcon className="size-5" />} title="POS Terminal" description="Order creation and folio posting" />
        <HubCard icon={<MenuManagementIcon className="size-5" />} title="Menu Management" description="Items, pricing, categories per outlet" />
      </div>
    </Container>
  );
}
