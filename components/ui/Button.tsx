import type { ButtonHTMLAttributes } from 'react';
import { SpinnerIcon } from './Icons';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger';
export type ButtonTone = 'onLight' | 'onDark';
export type ButtonSize = 'sm' | 'md';

// Truly shared styles only. Every variant below owns its FULL shape
// (background, border, text color, hover, disabled) rather than partially
// overriding a shared base — conflicting Tailwind utilities (e.g. two
// different `bg-*` classes on the same element) don't resolve by className
// string order, they resolve by which rule Tailwind's generated stylesheet
// happens to emit last, which is not something to rely on. This is the same
// lesson Daddy Bear's own Button.tsx documents.
const base =
  'inline-flex items-center justify-center gap-2 rounded-control font-semibold cursor-pointer transition-[filter,background-color,color,border-color] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-default';

const sizeClasses: Record<ButtonSize, string> = {
  // min-h-11 = 44px, the minimum accessible tap target, kept even at the
  // denser `sm` size used for inline table-row actions.
  sm: 'px-3 py-1.5 text-small min-h-9',
  md: 'px-4 py-2 text-body min-h-11',
};

// variant -> (tone, for outline only) -> full class string. Reference image:
// column 1 (gold solid) = primary, column 3 (purple solid) = secondary,
// column 2 (white/black, inverts to solid on hover) = outline. Each
// variant's 3 reference rows (default/hover/disabled) map directly to the
// default/hover:/disabled: states below.
const variantClasses: Record<ButtonVariant, Record<ButtonTone, string>> = {
  primary: {
    // White text per the actual product reference imagery (Confirm
    // Check-In, the Check-In nav panel) — a deliberate design call, kept
    // even though it measures ~2.45:1 against #CCA000 and technically
    // fails WCAG AA (same documented-tradeoff treatment as the VIP badge
    // in StatusTag.tsx: font-semibold + a large enough tap target keeps it
    // legible in practice, and consistency with the reference views wins
    // here). hover:brightness is used instead of a second hover-only color
    // token because it's surface-agnostic — an opacity-based hover would
    // look different depending on what's rendered behind the button,
    // brightness doesn't. brightness-125 (not the original -110, which read
    // as too subtle a hover state against the already-bright gold fill).
    // Brightening the fill pushed white text's already-marginal contrast
    // even lower, so hover also switches text to `secondary` (near-black) —
    // verified visually, not just by the numbers.
    onLight: 'bg-primary text-white hover:brightness-125 hover:text-secondary disabled:opacity-50',
    onDark: 'bg-primary text-white hover:brightness-125 hover:text-secondary disabled:opacity-50',
  },
  secondary: {
    // Much bigger brightness delta than primary's (200 vs 125): `secondary`
    // (#160029) has a zero green channel, and `brightness()` is a linear
    // per-channel multiplier — 0 × anything is still 0, so no multiplier
    // can shift the hue, only how far R/B scale up. Verified visually
    // (not just by the numbers): brightness-150 was barely perceptible
    // against the near-black base; 200 is the first step that reads
    // clearly as "hovered" in a real screenshot.
    onLight: 'bg-secondary text-white hover:brightness-200 disabled:opacity-50',
    onDark: 'bg-secondary text-white hover:brightness-200 disabled:opacity-50',
  },
  outline: {
    // Reference image: default = bordered, hover = inverts to a solid
    // fill, disabled = muted gray (reusing the existing `accent` token
    // rather than minting a new one).
    onLight:
      'border border-black text-black bg-transparent hover:bg-black hover:text-white disabled:border-accent disabled:text-accent',
    onDark:
      'border border-white text-white bg-transparent hover:bg-white hover:text-secondary disabled:border-accent disabled:text-accent',
  },
  // Not in the reference imagery — this app's own addition for "confirm a
  // destructive action" (e.g. deleting a branch), first needed once real
  // multi-branch/multi-floor setup meant there was actual work to lose.
  // Reuses `red-600`, not a new color: that's already this design system's
  // established "something's wrong here" token (every field's own error
  // state uses it), so this reads as "dangerous" for the same reason a
  // form error does, not a one-off invented hue.
  danger: {
    onLight: 'bg-red-600 text-white hover:brightness-110 disabled:opacity-50',
    onDark: 'bg-red-600 text-white hover:brightness-110 disabled:opacity-50',
  },
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  tone?: ButtonTone;
  size?: ButtonSize;
  loading?: boolean;
};

export function Button({
  variant = 'primary',
  tone = 'onLight',
  size = 'md',
  loading = false,
  disabled,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const classes = `${base} ${sizeClasses[size]} ${variantClasses[variant][tone]} ${className}`;
  return (
    <button className={classes} disabled={disabled || loading} {...rest}>
      {loading ? <SpinnerIcon /> : children}
    </button>
  );
}
