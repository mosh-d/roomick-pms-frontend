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

export function CheckCircleIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// --- Page-header icons (Roomick-UI.pdf pages 11-19 each pair their H1 with one) ---

/** Arrivals Dashboard (ref p11) — a landing plane. */
export function PlaneLandingIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden="true">
      <path d="M2 20h20" strokeLinecap="round" />
      <path d="M3.5 9.2l1.6-.4 3 2.5 4.2-1.1-3.6-6 2-.5 5.4 5.5 3.6-1c.8-.2 1.6.3 1.8 1.1.2.8-.3 1.6-1.1 1.8L4.7 15.4a1.5 1.5 0 0 1-1.8-1L2 10.6l1.5-1.4z" strokeLinejoin="round" />
    </svg>
  );
}

/** Departures Dashboard (ref p15) — a taking-off plane. */
export function PlaneTakeoffIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden="true">
      <path d="M2 20h20" strokeLinecap="round" />
      <path d="M4.2 13.6l-.8-4 1.5-.4 2.3 2.2 3.6-1-2.6-6.4 2-.6 4.7 6 3.6-1c.8-.2 1.6.3 1.8 1.1.2.8-.3 1.6-1.1 1.8L6 15.1a1.5 1.5 0 0 1-1.8-1.5z" strokeLinejoin="round" />
    </svg>
  );
}

/** In-House Guest List (ref p18) — a document/list. */
export function ClipboardListIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden="true">
      <path d="M5 4.5h14v15H5z" strokeLinejoin="round" />
      <path d="M8.5 9h7M8.5 12.5h7M8.5 16h4" strokeLinecap="round" />
    </svg>
  );
}

/** Check-In / Check-Out Flow (ref p12, p16) — a building with a door arrow. */
export function BuildingArrowIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden="true">
      <path d="M4 20V6.5L12 3l8 3.5V20" strokeLinejoin="round" />
      <path d="M2.5 20h19" strokeLinecap="round" />
      <path d="M10 20v-4.5h4V20" strokeLinejoin="round" />
      <path d="M8.5 10h2M13.5 10h2" strokeLinecap="round" />
    </svg>
  );
}

/** Walk-In Booking (ref p14) — a walking guest with luggage. */
export function WalkInIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden="true">
      <circle cx="10" cy="4.2" r="1.7" />
      <path d="M10.5 7.5L8 11l-2.5 3M10.5 7.5l2.5 2 1.5 3.5M8 11l1 4-2 5M13 13l1.5 3.5.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17.5 12.5h3.5v8h-3.5z" strokeLinejoin="round" />
      <path d="M18.6 12.5v-1.3h1.3v1.3" strokeLinejoin="round" />
    </svg>
  );
}

/** Guest Folio / Billing (ref p33) — a receipt. */
export function ReceiptIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden="true">
      <path d="M5.5 3.5h13v17l-2.2-1.5-2.2 1.5-2.1-1.5-2.2 1.5-2.1-1.5-2.2 1.5z" strokeLinejoin="round" />
      <path d="M9 8h6M9 12h6" strokeLinecap="round" />
    </svg>
  );
}

// --- Table chrome (ref p11/p18: search field, sortable headers, pagination, export) ---

export function SearchIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" strokeLinecap="round" />
    </svg>
  );
}

/** The paired up/down arrows the reference puts beside every sortable column header. */
export function SortIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <path d="M8 4v16M8 4 4.5 7.5M8 4l3.5 3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M16 20V4M16 20l3.5-3.5M16 20l-3.5-3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowLeftIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <path d="M19 12H5M5 12l6-6M5 12l6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ArrowRightIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <path d="M5 12h14M19 12l-6-6M19 12l-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DownloadIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <path d="M12 3v12M12 15l-4-4M12 15l4-4M4 19h16" strokeLinecap="round" strokeLinejoin="round" />
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
