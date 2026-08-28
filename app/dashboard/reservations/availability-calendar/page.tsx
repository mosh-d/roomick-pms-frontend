'use client';

import { useState } from 'react';
import { Container } from '@/components/ui/Container';
import { Card } from '@/components/ui/Card';
import { PageHeader } from '@/components/ui/PageHeader';
import { Select, type SelectOption } from '@/components/ui/Select';
import { CalendarIcon } from '@/components/ui/Icons';
import { useAvailabilityCalendarQuery } from '@/lib/reservations';
import { useAuthStore } from '@/lib/store/authStore';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function currentYearMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/** Green when comfortably open, amber when tight, red when full — same three-way read as the reference's own occupancy row, applied per cell instead of only at the bottom. */
function availabilityTone(available: number): string {
  if (available === 0) return 'bg-red-100 text-red-700';
  if (available <= 2) return 'bg-amber-100 text-amber-800';
  return 'bg-green-50 text-green-700';
}

/**
 * Availability Calendar (ref p21) — reduced from the reference's per-room
 * Gantt chart (individual room rows, guest-name bars spanning their exact
 * stay) to a per-room-TYPE grid (available count per date). The full
 * per-room view needs the same day-by-day room-occupancy data the Room
 * Status Board already renders live for TODAY only; extending that to an
 * arbitrary month of individual reservation bars is a real visualization
 * project of its own, not a slice of this phase. This still answers the
 * question the card promises — "see room availability by date" — for
 * every date in the month, not just today.
 */
export default function AvailabilityCalendarPage() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const activeBranchId = useAuthStore((s) => s.activeBranchId);
  const auth = { accessToken: accessToken ?? undefined, tenantId: user?.tenantId };

  const [{ year, month }, setYearMonth] = useState(currentYearMonth);
  const calendarQuery = useAvailabilityCalendarQuery(activeBranchId, year, month, auth);

  const yearOptions: SelectOption[] = [0, 1, 2].map((offset) => {
    const y = currentYearMonth().year + offset;
    return { value: String(y), label: String(y) };
  });
  const monthOptions: SelectOption[] = MONTHS.map((name, i) => ({ value: String(i + 1), label: name }));

  if (!activeBranchId) return null;

  const roomTypes = calendarQuery.data?.roomTypes ?? [];
  const dates = roomTypes[0]?.nights.map((n) => n.date) ?? [];

  return (
    <Container className="max-w-6xl py-10 flex flex-col gap-6">
      <PageHeader icon={<CalendarIcon className="size-8" />} title="Availability Calendar" subtitle="See room availability by date" />

      <div className="flex flex-wrap gap-4 max-w-md">
        <div className="w-40">
          <Select id="calendar-year" name="year" label="Year" options={yearOptions} value={String(year)} onChange={(v) => setYearMonth({ year: Number(v), month })} />
        </div>
        <div className="w-40">
          <Select id="calendar-month" name="month" label="Month" options={monthOptions} value={String(month)} onChange={(v) => setYearMonth({ year, month: Number(v) })} />
        </div>
      </div>

      {calendarQuery.isLoading ? (
        <p className="text-body text-primary-dark/70">Loading availability…</p>
      ) : calendarQuery.isError ? (
        <p className="text-body text-red-600">Could not load the availability calendar. Please try refreshing.</p>
      ) : roomTypes.length === 0 ? (
        <p className="text-body text-primary-dark/70">No room types are set up at this branch yet.</p>
      ) : (
        <Card tone="secondary" className="overflow-x-auto">
          <table className="border-collapse">
            <thead>
              <tr>
                <th className="sticky left-0 bg-secondary/5 text-small font-bold text-secondary text-left py-2 pr-4 pl-1 whitespace-nowrap">Room Type</th>
                {dates.map((date) => (
                  <th key={date} className="text-tiny font-semibold text-secondary-light text-center py-2 px-1 whitespace-nowrap">
                    {new Date(date).getDate()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {roomTypes.map((rt) => (
                <tr key={rt.roomTypeId} className="border-t border-secondary/10">
                  <td className="sticky left-0 bg-secondary/5 text-small font-semibold text-secondary py-2 pr-4 pl-1 whitespace-nowrap">{rt.roomTypeName}</td>
                  {rt.nights.map((night) => (
                    <td key={night.date} className="text-center py-1 px-1">
                      <span className={`inline-flex items-center justify-center size-7 rounded-control text-tiny font-semibold ${availabilityTone(night.available)}`} title={`${night.available} available on ${night.date}`}>
                        {night.available}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </Container>
  );
}
