'use client';

import { Container } from '@/components/ui/Container';
import { Section } from '@/components/ui/Section';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  CalendarIcon,
  CreateReservationIcon,
  ModifyReservationIcon,
  CancelReservationIcon,
  WaitlistIcon,
  ReceiptIcon,
} from '@/components/ui/Icons';
import { useReservationsQuery } from '@/lib/reservations';
import { useAuthStore } from '@/lib/store/authStore';
import { HubCard } from '../_components/HubCard';

/**
 * Reservations hub (Roomick-UI.pdf p20) — the sidebar's "Reservations" row
 * has pointed nowhere since Phase 24 flagged it inert; this is that page.
 *
 * Six cards, five real. **Rate Plan Management stays inert** — the
 * reference's Create/Modify screens show a full rate-plan picker
 * (promotional code / negotiated / base) that needs a cascade-tier rate
 * resolver, its own module on the scale of Taxes or Folios, not a slice of
 * this one. Every real page here instead prices a stay at flat
 * `roomType.baseRate × nights`, the same derivation Walk-In Booking and
 * check-in already use — named explicitly in PHASE_NOTES.md, not silently
 * dropped.
 */
export default function ReservationsHubPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const confirmedQuery = useReservationsQuery(activeBranchId, { status: 'confirmed' }, auth);
  const waitlistQuery = useReservationsQuery(activeBranchId, { status: 'waitlisted' }, auth);
  const cancelledQuery = useReservationsQuery(activeBranchId, { status: 'cancelled' }, auth);

  if (!activeBranchId) return null;

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader title="Reservations" subtitle="Full booking lifecycle management." />

      <Section label="Reservations">
        <div className="flex flex-wrap gap-4">
          <HubCard
            icon={<CalendarIcon className="size-5" />}
            title="Availability Calendar"
            description="Visual room availability by date"
            href="/dashboard/reservations/availability-calendar"
          />
          <HubCard
            icon={<CreateReservationIcon className="size-5" />}
            title="Create Reservation"
            description="Book an individual reservation"
            href="/dashboard/reservations/create"
          />
          <HubCard
            icon={<ModifyReservationIcon className="size-5" />}
            title="Modify Reservation"
            description="Date changes, room type changes"
            stats={confirmedQuery.data ? [`${confirmedQuery.data.length} confirmed reservations`] : undefined}
            href="/dashboard/reservations/modify"
          />
          <HubCard
            icon={<CancelReservationIcon className="size-5" />}
            title="Cancel Reservation"
            description="Handle cancellations"
            stats={cancelledQuery.data ? [`${cancelledQuery.data.length} recently cancelled`] : undefined}
            href="/dashboard/reservations/cancel"
          />
          <HubCard
            icon={<WaitlistIcon className="size-5" />}
            title="Waitlist Management"
            description="Future bookings, earliest availability"
            stats={waitlistQuery.data ? [`${waitlistQuery.data.length} reservations on waitlist`] : undefined}
            href="/dashboard/reservations/waitlist"
          />
          <HubCard
            icon={<ReceiptIcon className="size-5" />}
            title="Rate Plan Management"
            description="Base, seasonal, weekend, corporate, promo"
          />
        </div>
      </Section>
    </Container>
  );
}
