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

/**
 * Departures Dashboard (ref p10 card AND p15 header) — a city skyline with a
 * plane climbing away from it, NOT a bare plane. Arrivals is the bare plane;
 * departures pairs it with the buildings the guest is leaving. Checked against
 * both pages directly — an earlier version of this file used a plain
 * take-off plane here and claimed p15 showed one, which it doesn't.
 *
 * The plane reuses the take-off geometry inside a scaled `<g>` rather than a
 * second hand-drawn copy; `strokeWidth` is pre-multiplied by the inverse of
 * the scale so the stroke still renders at the same 1.6 as everything else.
 */
export function CityDepartureIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden="true">
      <path d="M2.5 21h13" strokeLinecap="round" />
      <path d="M3.5 21V7.5h3.5V21" strokeLinejoin="round" />
      <path d="M5.25 7.5V5" strokeLinecap="round" />
      <path d="M7 21v-6.5h7.5V21" strokeLinejoin="round" />
      <path d="M9.4 17.6h.5M12 17.6h.5" strokeLinecap="round" />
      <g transform="translate(11.6 1.2) scale(0.52)">
        <path
          d="M4.2 13.6l-.8-4 1.5-.4 2.3 2.2 3.6-1-2.6-6.4 2-.6 4.7 6 3.6-1c.8-.2 1.6.3 1.8 1.1.2.8-.3 1.6-1.1 1.8L6 15.1a1.5 1.5 0 0 1-1.8-1.5z"
          strokeWidth={3.08}
          strokeLinejoin="round"
        />
      </g>
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

/** Availability Calendar (ref p10 card, p21 header) — a calendar grid. */
export function CalendarIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden="true">
      <path d="M4.5 5.5h15v14h-15z" strokeLinejoin="round" />
      <path d="M4.5 9.5h15" strokeLinecap="round" />
      <path d="M8 3.5v3.5M16 3.5v3.5" strokeLinecap="round" />
      <path d="M8 13h2M8 16.5h2M14 13h2M14 16.5h2" strokeLinecap="round" />
    </svg>
  );
}

/** Create Reservation (ref p10 card, p22 header) — two people, one with a plus. */
export function CreateReservationIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden="true">
      <circle cx="9" cy="7.5" r="2.6" />
      <path d="M3.5 20v-1.5A4.5 4.5 0 0 1 8 14h2a4.5 4.5 0 0 1 4.5 4.5V20" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 5.5v5M14.5 8h5" strokeLinecap="round" />
    </svg>
  );
}

/** Modify Reservation (ref p10 card, p23 header) — a clipboard with a pencil, distinguishing it from the plain `ClipboardListIcon`. */
export function ModifyReservationIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden="true">
      <path d="M5 4.5h9.5v6.5" strokeLinejoin="round" />
      <path d="M5 4.5v15h7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 9h6.5M8.5 12.5h3.5" strokeLinecap="round" />
      <path d="M20.3 12.7l1.4 1.4-7.2 7.2H12.7v-1.8z" strokeLinejoin="round" />
    </svg>
  );
}

/** Cancel Reservation (ref p10 card, p24 header) — a clipboard with a circled X. */
export function CancelReservationIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden="true">
      <path d="M5 4.5h14v10.5" strokeLinejoin="round" />
      <path d="M5 4.5v15h7.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 9h7M8.5 12.5h4" strokeLinecap="round" />
      <circle cx="17.5" cy="17.5" r="3.7" />
      <path d="M16.2 16.2l2.6 2.6M18.8 16.2l-2.6 2.6" strokeLinecap="round" />
    </svg>
  );
}

/** Waitlist Management (ref p10 card) — a clipboard with a clock. */
export function WaitlistIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden="true">
      <path d="M5 4.5h10.5v9" strokeLinejoin="round" />
      <path d="M5 4.5v15h7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8.5 9h6M8.5 12.5h3" strokeLinecap="round" />
      <circle cx="17" cy="17" r="4.3" />
      <path d="M17 14.7v2.3l1.6 1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Check-In Flow (ref p10 card, p12 header) — a starred hotel with an arrow
 * entering its door from the left. The stars are what make it a *hotel*
 * rather than a generic building, and they're in the reference on both the
 * hub card and the page header, so they're not decoration to drop.
 *
 * Paired with `HotelCheckOutIcon`, which is the same hotel with the arrow
 * leaving on the right. The two only differ by arrow direction, exactly as
 * the reference draws them — that contrast is the whole point, so keep them
 * geometrically identical apart from the arrow.
 */
export function HotelCheckInIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden="true">
      <path d="M9 20.5V10l6-3 6 3v10.5" strokeLinejoin="round" />
      <path d="M8 20.5h14" strokeLinecap="round" />
      <path d="M13 20.5v-4h4v4" strokeLinejoin="round" />
      <path d="M11.6 13h1.2M17.2 13h1.2" strokeLinecap="round" />
      <HotelStars cx={15} />
      <path d="M2 17.5h5.5" strokeLinecap="round" />
      <path d="M5.4 15.4l2.1 2.1-2.1 2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Check-Out Flow (ref p10 card, p16 header) — the same hotel, arrow leaving. */
export function HotelCheckOutIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden="true">
      <path d="M3 20.5V10l6-3 6 3v10.5" strokeLinejoin="round" />
      <path d="M2 20.5h14" strokeLinecap="round" />
      <path d="M7 20.5v-4h4v4" strokeLinejoin="round" />
      <path d="M5.6 13h1.2M11.2 13h1.2" strokeLinecap="round" />
      <HotelStars cx={9} />
      <path d="M16.5 17.5H22" strokeLinecap="round" />
      <path d="M19.9 15.4l2.1 2.1-2.1 2.1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * The three stars above a hotel roof, shared by the check-in and check-out
 * icons so the pair can't drift apart. Filled, not stroked — at 20px a
 * stroked 2px star is a smudge.
 */
function HotelStars({ cx }: { cx: number }) {
  return (
    <g fill="currentColor" stroke="none">
      {[
        [cx - 3.4, 5.2],
        [cx, 4],
        [cx + 3.4, 5.2],
      ].map(([x, y]) => (
        <path key={`${x}-${y}`} d={`M${x} ${y - 1.1}l.42.68.75.2-.5.6.05.78-.72-.28-.72.28.05-.78-.5-.6.75-.2z`} />
      ))}
    </g>
  );
}

/**
 * Room Change (ref p10 card) — two bent arrows swapping past each other: one
 * turning down on the left, one turning up on the right.
 *
 * The proportions matter more than they look. A first pass put the two
 * horizontals 8 units apart with small 2.8-wide heads, and at 20px the result
 * read as a plain rounded rectangle — the heads vanished and the two stalks
 * closed into a loop. Keeping the horizontals close (9.5 and 14.5) while the
 * stalks run long and the heads sit well clear of them is what makes it
 * legible as two arrows at icon size.
 */
export function RoomChangeIcon({ className = 'size-4' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className} aria-hidden="true">
      <path d="M16.5 9.5H8.5a2 2 0 0 0-2 2v7.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 16.2l2.5 2.9 2.5-2.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 14.5h8a2 2 0 0 0 2-2V4.9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 7.8l2.5-2.9 2.5 2.9" strokeLinecap="round" strokeLinejoin="round" />
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
