import type { ReactNode } from 'react';
import { CARD_TONE_CLASSES, type CardTone } from './Card';

/**
 * A labeled content section — the reference product's recurring page
 * structure (e.g. "EARLY CHECK-IN", "GUEST DETAILS", "ID CAPTURE" in the
 * Check-In Flow): a small-caps gold label + horizontal rule sitting above
 * a pale, thin-bordered box.
 *
 * `tone` defaults to `primary` — the pale-gold box every interactive-form
 * Section in the app still uses (this is the ONE place `primary-light`
 * appears as a background). `ReviewStep`'s own cards pass `tone="accent"`
 * instead: they're read-only recap boxes, not a field group to fill in,
 * so they get `Card.tsx`'s `accent` tone (cool slate, `accent-dark/10`
 * background) rather than the gold — reusing `CARD_TONE_CLASSES` directly
 * instead of a separately hand-tuned copy, same reasoning as `RadioCard`'s
 * own reuse of it (see Card.tsx's header comment on why hand-copying this
 * mapping is how things drift). Ignore what the product reference itself
 * renders for this specific screen — direct call: review/detail cards use
 * this system's own `accent` token, not the mockup's colors.
 *
 * Uses `primary-text` (the AA-contrast-safe gold, not raw `primary`) for
 * the label regardless of `tone` — the label itself is always this app's
 * one consistent gold, only the box beneath it changes.
 */
export function Section({
  label,
  tone = 'primary',
  className = '',
  children,
}: {
  label: string;
  tone?: CardTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center gap-3">
        <h3 className="text-tiny font-bold uppercase tracking-wide text-primary-text whitespace-nowrap">{label}</h3>
        <div className="h-px flex-1 bg-accent/30" />
      </div>
      <div className={`rounded-card border p-4 flex flex-col gap-4 ${CARD_TONE_CLASSES[tone]}`}>{children}</div>
    </div>
  );
}
