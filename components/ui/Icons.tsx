/**
 * Hand-rolled inline SVG icons — no icon library dependency, matching
 * Roomick's "no dependency we don't need" stance (see design-system/05-
 * imagery-motion.md). Each icon is `currentColor`-based so it inherits text
 * color from its parent, and accepts a `className` for sizing (default
 * `size-4`, i.e. 1rem — override per call site with e.g. `size-5`).
 *
 * `aria-hidden` is set on every icon: these are always paired with visible
 * text or an explicit `aria-label` on the interactive element that contains
 * them (a button, a toggle) — the icon itself carries no independent
 * meaning a screen reader needs to announce.
 */

type IconProps = { className?: string };

export function ChevronDownIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function XIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function UploadCloudIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <path
        d="M7 18a4.5 4.5 0 0 1-1-8.9 5 5 0 0 1 9.8-1.7A4 4 0 0 1 17 15.9M12 12v9M9 15l3-3 3 3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function PlusIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function InfoCircleIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5.5" strokeLinecap="round" />
      <circle cx="12" cy="7.75" r="0.75" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function EyeIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <path
        d="M3 3l18 18M10.6 10.6a3 3 0 0 0 4.24 4.24M9.4 5.5A10.9 10.9 0 0 1 12 5c6.5 0 10 7 10 7a13.2 13.2 0 0 1-3.1 3.9M6.3 6.9C3.9 8.6 2 12 2 12s3.5 7 10 7c1.2 0 2.3-.2 3.3-.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SpinnerIcon({ className = 'size-4' }: IconProps) {
  // Used for Button's `loading` state. Animation respects
  // prefers-reduced-motion globally via app/globals.css.
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`${className} animate-spin`} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={2} opacity={0.25} />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}
