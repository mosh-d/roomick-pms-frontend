'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

/**
 * One card in the Front Desk hub grid (Roomick-UI.pdf page 10). Two
 * variants, driven by whether `href` is passed:
 *
 * - **Linked** (`href` set): a real page exists — `Room Status Board` is
 *   the only one today. Renders as a genuine `Link`, hover/focus states,
 *   and any `stats` passed are real numbers derived from live data.
 * - **Inert** (`href` omitted): the reference shows this card (Arrivals
 *   Dashboard, Check-In Flow, Walk-In Booking, …) but nothing is built
 *   behind it yet — see PHASE_NOTES.md's backend build order
 *   (reservations/check-in/housekeeping-tasks/billing have zero modules
 *   registered). Rendered plain and non-interactive rather than either
 *   omitted (which would misrepresent the app's own documented
 *   architecture) or linked nowhere. Never pass fabricated `stats` to an
 *   inert card — there's no real data behind these yet, and a
 *   confidently-wrong number is worse than none.
 */
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
      <p className="text-small text-secondary-light pb-2 border-b border-secondary/20">{description}</p>
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
        className="flex-1 min-w-64 flex flex-col gap-2 rounded-card border border-accent/30 bg-secondary/5 p-4 hover:bg-secondary/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {content}
      </Link>
    );
  }

  return (
    <div title="Not built yet" className="flex-1 min-w-64 flex flex-col gap-2 rounded-card border border-accent/30 bg-secondary/5 p-4 opacity-70">
      {content}
    </div>
  );
}
