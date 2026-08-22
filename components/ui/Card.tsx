import type { ReactNode } from 'react';

export type CardTone = 'primary' | 'secondary' | 'accent';

// Tinted with the DARK variant of each color family (primary-dark,
// accent-dark), not the base color — secondary needs no separate "dark"
// variant since #160029 already is one. This isn't just a shade
// preference: raw `primary`/`accent` are light-to-mid tones, and
// compounding their opacity over a handful of nesting levels converges on
// a pastel that sits uncomfortably close in perceived lightness to
// text-secondary-light — exactly what made depth-4 text in the nesting
// demo nearly unreadable before this fix. Dark-variant bases converge on a
// deeper, richer tint instead, which stays reliably readable under plain
// text-secondary (near-black) regardless of nesting depth. See
// design-system/01-color.md for the contrast reasoning in full.
// Exported (not just module-private) so other components that need to look
// like a Card — but can't literally render a <Card>, e.g. RadioCard.tsx's
// clickable <label> — reuse the exact same tone→class mapping instead of
// hand-copying it. Hand-copying is how the old BrandRadioCard drifted out
// of sync with Card's own tone colors after the dark-variant fix; sharing
// the constant makes that class of drift impossible.
export const CARD_TONE_CLASSES: Record<CardTone, string> = {
  primary: 'bg-primary-dark/10 border-primary-dark/20',
  secondary: 'bg-secondary/10 border-secondary/20',
  accent: 'bg-accent-dark/10 border-accent-dark/20',
};

/**
 * The card-nesting pattern: every Card — at every depth — uses the exact
 * same 10%-opacity tint. There is deliberately no `level` prop. Depth
 * itself does the work: nest a Card inside a Card of the same tone and the
 * two 10%-opacity layers *compound* (alpha-over compositing, not addition —
 * see design-system/01-color.md for the worked math:
 * effective_tint(N) = 1 - 0.9^N), so a 2-deep nest reads as ~19% tinted, a
 * 3-deep nest as ~27%, and so on. That's the entire visual-hierarchy
 * mechanism: how many Cards you're inside of, not a token you have to pick.
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
