import type { ReactNode } from 'react';
import { XIcon } from './Icons';
import { CARD_TONE_CLASSES, type CardTone } from './Card';

/**
 * A titled, removable, repeatable entry — the pattern behind "Rule 1"/
 * "Rule 2", "Staff 1"/"Staff 2", "Building 1"/"Building 2", "Room Type 1"/
 * "Room Type 2", "Cost 1"/"Cost 2" throughout the reference product:
 * anywhere a user can add multiple instances of something and remove any
 * one of them.
 *
 * Tinted with `Card`'s secondary opacity fill (imported via
 * `CARD_TONE_CLASSES`, not hand-copied — same reuse reasoning as
 * `RadioCard`) — this IS a nested content surface sitting inside a
 * `Section`, same as any other nested Card, and follows the same
 * "secondary, not primary again" rule.
 */
export function EntryCard({
  title,
  tone = 'secondary',
  onRemove,
  className = '',
  children,
}: {
  title: string;
  tone?: CardTone;
  /** Omit to render a non-removable entry (e.g. the last remaining one in a list that requires at least one). */
  onRemove?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-card border p-4 flex flex-col gap-4 ${CARD_TONE_CLASSES[tone]} ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-body font-bold text-secondary">{title}</h4>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${title}`}
            className="text-secondary-light hover:text-secondary cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
          >
            <XIcon />
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}
