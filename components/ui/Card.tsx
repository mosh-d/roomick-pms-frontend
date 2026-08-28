import type { ReactNode } from 'react';

export type CardTone = 'primary' | 'secondary' | 'accent';

// secondary/accent are tinted with the DARK variant of each color family
// (accent-dark; secondary needs no separate "dark" variant since #160029
// already is one). This isn't just a shade preference: raw `secondary`/
// `accent` are light-to-mid tones, and compounding their opacity over a
// handful of nesting levels converges on a pastel that sits uncomfortably
// close in perceived lightness to text-secondary-light — exactly what made
// depth-4 text in the nesting demo nearly unreadable before this fix.
// Dark-variant bases converge on a deeper, richer tint instead, which stays
// reliably readable under plain text-secondary (near-black) regardless of
// nesting depth. See design-system/01-color.md for the contrast reasoning
// in full.
//
// `primary` is the one deliberate exception: it reuses `Section`'s own
// `primary-light`/`primary` pairing (see Section.tsx) instead of a
// dark-variant tint — checked directly against the UI reference, which
// renders a primary-toned highlight as a pale warm-gold box, not the muddy
// tan `primary-dark` would produce. A primary-toned box is used as a
// one-off highlight (matching Section), not deep neutral hierarchy —
// nesting it several levels deep isn't a real usage pattern the way
// secondary/accent nesting is.
//
// The base RATE below has moved twice, for two different reasons — worth
// knowing before touching it a third time. `secondary`/`primary` both
// started higher (10%/15%) and were later revised down to the SAME 5% for
// a lighter rest state overall, a direct design call, not a measurement;
// `accent` was never part of that revision and is still 10%. If either
// number moves again, `app/style-guide/_sections/ColorSection.tsx`'s own
// `SECONDARY_BASE_RATE` constant has to be updated by hand to match — it
// can't read this object directly (it needs the bare number for the
// nesting-depth formula, not a class string).
// Exported (not just module-private) so other components that need to look
// like a Card — but can't literally render a <Card>, e.g. RadioCard.tsx's
// clickable <label> — reuse the exact same tone→class mapping instead of
// hand-copying it. Hand-copying is how the old BrandRadioCard (and later,
// FeatureCard.tsx) drifted out of sync with Card's own tone colors; sharing
// the constant makes that class of drift impossible.
export const CARD_TONE_CLASSES: Record<CardTone, string> = {
  primary: 'bg-primary-light/5 border-primary/40',
  secondary: 'bg-secondary/5 border-secondary/20',
  accent: 'bg-accent-dark/10 border-accent-dark/20',
};

/**
 * The card-nesting pattern: every Card — at every depth, within one tone —
 * uses the exact same opacity tint (5% for secondary/primary, 10% for
 * accent — see CARD_TONE_CLASSES above). There is deliberately no `level`
 * prop. Depth itself does the work: nest a Card inside a Card of the same
 * tone and the layers *compound* (alpha-over compositing, not addition —
 * see design-system/01-color.md for the worked math:
 * effective_tint(N) = 1 - (1 - tint)^N), so secondary/primary read as ~9.8%
 * at 2 deep, ~14.3% at 3 deep, and so on (accent compounds faster, at its
 * own 10% base). That's the entire visual-hierarchy mechanism: how many
 * Cards you're inside of, not a token you have to pick.
 *
 * Text placed directly on a Card should use `text-secondary` (the app's
 * default dark body-text color), not `text-secondary-light` — see the
 * TONE_CLASSES comment above for why the lighter text color loses contrast
 * as nesting compounds.
 */
export function Card({
  tone = 'secondary',
  className = '',
  children,
}: {
  tone?: CardTone;
  className?: string;
  children: ReactNode;
}) {
  return <div className={`${CARD_TONE_CLASSES[tone]} border rounded-card p-4 ${className}`}>{children}</div>;
}
