'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { CARD_TONE_CLASSES } from '@/components/ui/Card';

/**
 * One card in the Front Desk hub grid (Roomick-UI.pdf page 10). Two
 * variants, driven by whether `href` is passed:
 *
 * - **Linked** (`href` set): a real page exists — Room Status Board,
 *   Arrivals/Departures Dashboards, In-House Guest List, Check-In/Check-
 *   Out Flow (each its own page with a guest picker, so the flow is
 *   reachable without first finding the guest on a dated dashboard), and
 *   Walk-In Booking. Renders as a genuine `Link`, hover/focus states, and
 *   any `stats` passed are real numbers derived from live data.
 * - **Inert** (`href` omitted): the reference shows this card (Room
 *   Change, and everything under Reservations/Housekeeping/Billing/etc.
 *   in the sidebar) but nothing is built behind it yet — see
 *   PHASE_NOTES.md's backend build order (Folios/Payments/Housekeeping
 *   tasks have zero modules registered). Rendered plain and non-
 *   interactive rather than either omitted (which would misrepresent the
 *   app's own documented architecture) or linked nowhere. Never pass
 *   fabricated `stats` to an inert card — there's no real data behind
 *   these yet, and a confidently-wrong number is worse than none.
 */
/**
 * A linked card deepens its own tint on hover and a second step further on
 * press: `CARD_TONE_CLASSES.secondary`'s own rest-state alpha (currently 5%)
 * → 10% hovered → 15% active. Kept as a fixed step above whatever the rest
 * state currently is, not computed from it — `Card.tsx` owns the rest-state
 * value and can change it independently; this only needs "hover reads as
 * one step closer, press as one more" to stay true, not an exact multiple.
 *
 * `transition-colors`, not the `brightness` filter this used before — a
 * filter dims the text and border along with the background, which is why the
 * old hover made the card look greyed-out instead of raised.
 *
 * Applied only to the linked variant. An inert card doesn't respond to a
 * pointer, because nothing happens when you click it.
 */
const INTERACTIVE_TINT_STEPS = 'hover:bg-secondary/10 active:bg-secondary/15';

export function HubCard({
  icon,
  title,
  description,
  stats,
  href,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  stats?: string[];
  href?: string;
}) {
  const content = (
    <>
      <div className="flex items-center gap-2">
        {icon ? (
          <span className="text-secondary shrink-0" aria-hidden>
            {icon}
          </span>
        ) : null}
        <span className="text-body font-bold text-secondary">{title}</span>
      </div>
      {/* Full-strength `secondary`, not `-light` — pixel-sampled against
          the reference (ref p10): the description's peak ink color lands
          on the exact same near-black as the bold title above it (both
          `#160029`-ish). It only READS lighter because it's a normal font
          weight over a smaller stroke area, not because it's a different,
          lighter color token. The stats line below, by contrast, pixel-
          samples to an exact match for `secondary-light` (`#A698B2`) — a
          real, different, genuinely lighter color, not a weight illusion. */}
      <p className="text-small text-secondary pb-2 border-b border-secondary/20">{description}</p>
      {stats && stats.length > 0 ? (
        <div className="flex flex-col gap-1">
          {stats.map((stat) => (
            <span key={stat} className="text-small text-secondary-light">
              {stat}
            </span>
          ))}
        </div>
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className={`flex flex-col gap-2 rounded-card border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${CARD_TONE_CLASSES.secondary} ${INTERACTIVE_TINT_STEPS}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div title="Not built yet" className={`flex-1 min-w-64 flex flex-col gap-2 rounded-card border p-4 opacity-70 ${CARD_TONE_CLASSES.secondary}`}>
      {content}
    </div>
  );
}
