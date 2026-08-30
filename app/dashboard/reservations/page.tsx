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
  RatePlanIcon,
} from '@/components/ui/Icons';
import { useReservationsQuery } from '@/lib/reservations';
import { useRatePlansQuery } from '@/lib/rate-resolver';
import { useAuthStore } from '@/lib/store/authStore';
import { HubCard } from '../_components/HubCard';

/**
 * Reservations hub (Roomick-UI.pdf p20) — the sidebar's "Reservations" row
 * has pointed nowhere since Phase 24 flagged it inert; this is that page.
 *
 * All six cards are real now — Rate Plan Management (the last inert one)
 * now has a Rate Resolver module behind it: every booking screen prices a
 * stay through the base/seasonal/weekend/corporate cascade and negotiated/
 * promotional overrides this page manages, not a flat `baseRate × nights`.
 */
export default function ReservationsHubPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const confirmedQuery = useReservationsQuery(activeBranchId, { status: 'confirmed' }, auth);
  const waitlistQuery = useReservationsQuery(activeBranchId, { status: 'waitlisted' }, auth);
  const cancelledQuery = useReservationsQuery(activeBranchId, { status: 'cancelled' }, auth);
  const ratePlansQuery = useRatePlansQuery(activeBranchId, auth);
  const activeRatePlanCount = (ratePlansQuery.data ?? []).filter((p) => p.isActive).length;

  if (!activeBranchId) return null;

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-8">
      <PageHeader title="Reservations" subtitle="Full booking lifecycle management." roles="Front Desk · Manager" />

      <Section label="Reservations">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
            icon={<RatePlanIcon className="size-5" />}
            title="Rate Plan Management"
            description="Base, seasonal, weekend, corporate, promo"
            stats={ratePlansQuery.data ? [`${activeRatePlanCount} active rate plans`] : undefined}
            href="/dashboard/reservations/rate-plans"
          />
        </div>
      </Section>
    </Container>
  );
}
