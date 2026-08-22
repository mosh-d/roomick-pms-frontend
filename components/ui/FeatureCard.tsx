import type { ReactNode } from 'react';
import Link from 'next/link';

type FeatureCardContentProps = {
  icon: ReactNode;
  title: string;
  description: string;
  /** Short stat/status lines shown below the description (e.g. "12 pending arrivals today") — matches the reference Front Desk hub. */
  stats?: string[];
};

const cardClasses =
  'text-left rounded-card bg-secondary/10 border border-secondary/20 p-4 flex flex-col gap-2 cursor-pointer transition-[filter] hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2';

function FeatureCardContent({ icon, title, description, stats }: FeatureCardContentProps) {
  return (
    <>
      <span className="flex items-center gap-2 text-body font-bold text-secondary">
        <span aria-hidden="true" className="text-secondary">
          {icon}
        </span>
        {title}
      </span>
      <span className="text-small text-secondary-light border-b border-accent/20 pb-2">{description}</span>
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
}

/**
 * A clickable navigation/summary tile — the pattern behind the Front Desk
 * hub's "Arrivals Dashboard" / "Check-In Flow" / "Room Status Board" cards:
 * icon + title, an underlined one-line description, then a few muted stat
 * lines. Distinct from `Card` (a passive content surface) — this is always
 * interactive and always navigates somewhere, so it renders as a real
 * `<Link>` (or `<button>` if `onClick` is given instead of `href`) rather
 * than a `<div>` with a click handler bolted on.
 */
export function FeatureCard({
  href,
  onClick,
  className = '',
  ...content
}: FeatureCardContentProps & { href?: string; onClick?: () => void; className?: string }) {
  if (href) {
    return (
      <Link href={href} className={`${cardClasses} ${className}`}>
        <FeatureCardContent {...content} />
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={`${cardClasses} ${className}`}>
      <FeatureCardContent {...content} />
    </button>
  );
}
