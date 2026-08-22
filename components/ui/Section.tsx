import type { ReactNode } from 'react';

/**
 * A labeled content section — the reference product's recurring page
 * structure (e.g. "EARLY CHECK-IN", "GUEST DETAILS", "ID CAPTURE" in the
 * Check-In Flow): a small-caps gold label + horizontal rule sitting above
 * a pale, thin-gold-bordered box.
 *
 * This is the ONE place `primary-light` appears as a background in the
 * whole system — reserved for section-level wrappers (and, separately,
 * whole-page review/summary wrappers). Nested content inside a Section
 * uses `Card`'s secondary/gray tone, never `primary`/`primary-light`
 * again — stacking two primary-family tints reads as muddy "mixing," not
 * deliberate layering (see design-system/01-color.md).
 *
 * Uses `primary-text` (the AA-contrast-safe gold, not raw `primary`) for
 * the label — small text needs the accessible variant.
 */
export function Section({ label, className = '', children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      <div className="flex items-center gap-3">
        <h3 className="text-tiny font-bold uppercase tracking-wide text-primary-text whitespace-nowrap">{label}</h3>
        <div className="h-px flex-1 bg-accent/30" />
      </div>
      <div className="rounded-card border border-primary/40 bg-primary-light/15 p-4 flex flex-col gap-4">{children}</div>
    </div>
  );
}
