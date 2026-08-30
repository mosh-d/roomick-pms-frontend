'use client';

import { Container } from '@/components/ui/Container';
import { PageHeader } from '@/components/ui/PageHeader';
import { GroupBlockIcon, EventSpaceIcon } from '@/components/ui/Icons';
import { HubCard } from '../_components/HubCard';

/**
 * Sales & Events (ref p19) — one of the architecture map's own named gaps
 * (`page-events`): group blocks, corporate contracts, event space
 * management, BEOs. No backend module registered yet.
 */
export default function SalesEventsPage() {
  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader title="Sales & Events" subtitle="Group blocks, corporate contracts, event space management, BEOs." roles="Sales · Events Manager" />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <HubCard icon={<GroupBlockIcon className="size-5" />} title="Group Block Creation" description="Allot rooms, set cut-off, track pickup" />
        <HubCard icon={<EventSpaceIcon className="size-5" />} title="Event Space Calendar" description="Meeting rooms, ballrooms, outdoor venues" />
      </div>
    </Container>
  );
}
