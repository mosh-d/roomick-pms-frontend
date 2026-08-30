/**
 * Thin wrappers around `react-icons` (Feather for generic UI chrome, Font
 * Awesome for domain/travel icons where an exact semantic match exists —
 * a landing plane, a receipt, a "ban" glyph for Room Blocking/OOO) — kept
 * as named exports rather than importing the underlying icons directly at
 * every call site, so every page in the app still imports from this one
 * module and a future icon swap only ever touches this file.
 *
 * Every wrapper keeps the exact same `{ className }` contract the app's
 * hand-drawn icons used before this: `currentColor`-based (react-icons
 * components inherit text color the same way), sized via the Tailwind
 * `size-*` utility passed in `className` (default `size-4`, i.e. 1rem).
 *
 * `aria-hidden` is set on every icon: these are always paired with visible
 * text or an explicit `aria-label` on the interactive element that contains
 * them (a button, a toggle) — the icon itself carries no independent
 * meaning a screen reader needs to announce.
 */

import {
  FiChevronDown,
  FiX,
  FiUploadCloud,
  FiCheck,
  FiCheckCircle,
  FiSearch,
  FiArrowLeft,
  FiArrowRight,
  FiDownload,
  FiPlus,
  FiInfo,
  FiEye,
  FiEyeOff,
  FiLoader,
  FiCalendar,
  FiEdit3,
  FiMenu,
  FiBell,
  FiCamera,
  FiRefreshCw,
} from 'react-icons/fi';
import {
  FaPlaneArrival,
  FaPlaneDeparture,
  FaClipboardList,
  FaSignInAlt,
  FaSignOutAlt,
  FaExchangeAlt,
  FaWalking,
  FaReceipt,
  FaSort,
  FaUserPlus,
  FaTasks,
  FaUsers,
  FaClipboardCheck,
  FaBan,
  FaClock,
  FaCalendarTimes,
  FaTags,
  FaUserSlash,
  FaLayerGroup,
  FaCashRegister,
  FaComments,
  FaEnvelope,
  FaSms,
  FaChartLine,
  FaShieldAlt,
} from 'react-icons/fa';

type IconProps = { className?: string };

export function ChevronDownIcon({ className = 'size-4' }: IconProps) {
  return <FiChevronDown className={className} aria-hidden="true" />;
}

export function XIcon({ className = 'size-4' }: IconProps) {
  return <FiX className={className} aria-hidden="true" />;
}

/** Mobile sidebar toggle — the dashboard shell has no other hamburger-menu affordance. */
export function MenuIcon({ className = 'size-4' }: IconProps) {
  return <FiMenu className={className} aria-hidden="true" />;
}

export function AlertsIcon({ className = 'size-4' }: IconProps) {
  return <FiBell className={className} aria-hidden="true" />;
}

export function CameraIcon({ className = 'size-4' }: IconProps) {
  return <FiCamera className={className} aria-hidden="true" />;
}

export function RetakeIcon({ className = 'size-4' }: IconProps) {
  return <FiRefreshCw className={className} aria-hidden="true" />;
}

export function UploadCloudIcon({ className = 'size-4' }: IconProps) {
  return <FiUploadCloud className={className} aria-hidden="true" />;
}

export function CheckIcon({ className = 'size-4' }: IconProps) {
  return <FiCheck className={className} aria-hidden="true" />;
}

export function CheckCircleIcon({ className = 'size-4' }: IconProps) {
  return <FiCheckCircle className={className} aria-hidden="true" />;
}

// --- Page-header icons (Roomick-UI.pdf pages 11-19 each pair their H1 with one) ---

/** Arrivals Dashboard (ref p11) — a landing plane. */
export function PlaneLandingIcon({ className = 'size-4' }: IconProps) {
  return <FaPlaneArrival className={className} aria-hidden="true" />;
}

/** Departures Dashboard (ref p10 card, p15 header) — a departing plane. */
export function CityDepartureIcon({ className = 'size-4' }: IconProps) {
  return <FaPlaneDeparture className={className} aria-hidden="true" />;
}

/** In-House Guest List (ref p18) — a document/list. */
export function ClipboardListIcon({ className = 'size-4' }: IconProps) {
  return <FaClipboardList className={className} aria-hidden="true" />;
}

/** Check-In Flow (ref p10 card, p12 header). Paired with `HotelCheckOutIcon` — the same sign-in/sign-out contrast the reference draws as one arrow direction vs. the other. */
export function HotelCheckInIcon({ className = 'size-4' }: IconProps) {
  return <FaSignInAlt className={className} aria-hidden="true" />;
}

/** Check-Out Flow (ref p10 card, p16 header) — the sign-out half of the `HotelCheckInIcon` pair. */
export function HotelCheckOutIcon({ className = 'size-4' }: IconProps) {
  return <FaSignOutAlt className={className} aria-hidden="true" />;
}

/** Room Change (ref p10 card) — two rooms swapping. */
export function RoomChangeIcon({ className = 'size-4' }: IconProps) {
  return <FaExchangeAlt className={className} aria-hidden="true" />;
}

/** Walk-In Booking (ref p14) — a walking guest. */
export function WalkInIcon({ className = 'size-4' }: IconProps) {
  return <FaWalking className={className} aria-hidden="true" />;
}

/** Guest Folio / Billing (ref p33) — a receipt. */
export function ReceiptIcon({ className = 'size-4' }: IconProps) {
  return <FaReceipt className={className} aria-hidden="true" />;
}

export function RatePlanIcon({ className = 'size-4' }: IconProps) {
  return <FaTags className={className} aria-hidden="true" />;
}

export function NoShowIcon({ className = 'size-4' }: IconProps) {
  return <FaUserSlash className={className} aria-hidden="true" />;
}

export function OverbookingIcon({ className = 'size-4' }: IconProps) {
  return <FaLayerGroup className={className} aria-hidden="true" />;
}

export function ShiftIcon({ className = 'size-4' }: IconProps) {
  return <FaCashRegister className={className} aria-hidden="true" />;
}

export function CommsLogIcon({ className = 'size-4' }: IconProps) {
  return <FaComments className={className} aria-hidden="true" />;
}

export function ReportsIcon({ className = 'size-4' }: IconProps) {
  return <FaChartLine className={className} aria-hidden="true" />;
}

/** Security & Roles (architecture map's `page-security`). */
export function SecurityIcon({ className = 'size-4' }: IconProps) {
  return <FaShieldAlt className={className} aria-hidden="true" />;
}

/** Channel icon in the communications timeline (ref: "Channel icon (email / SMS / push)"). Push/in-app-chat share the generic chat bubble — neither has a manual-send UI yet, so no channel-specific glyph was worth adding for them alone. */
export function CommsChannelIcon({ channel, className = 'size-4' }: IconProps & { channel: 'email' | 'sms' | 'push' | 'in_app_chat' }) {
  if (channel === 'email') return <FaEnvelope className={className} aria-hidden="true" />;
  if (channel === 'sms') return <FaSms className={className} aria-hidden="true" />;
  return <FaComments className={className} aria-hidden="true" />;
}

// --- Table chrome (ref p11/p18: search field, sortable headers, pagination, export) ---

export function SearchIcon({ className = 'size-4' }: IconProps) {
  return <FiSearch className={className} aria-hidden="true" />;
}

/** The paired up/down arrows the reference puts beside every sortable column header. */
export function SortIcon({ className = 'size-4' }: IconProps) {
  return <FaSort className={className} aria-hidden="true" />;
}

export function ArrowLeftIcon({ className = 'size-4' }: IconProps) {
  return <FiArrowLeft className={className} aria-hidden="true" />;
}

export function ArrowRightIcon({ className = 'size-4' }: IconProps) {
  return <FiArrowRight className={className} aria-hidden="true" />;
}

export function DownloadIcon({ className = 'size-4' }: IconProps) {
  return <FiDownload className={className} aria-hidden="true" />;
}

export function PlusIcon({ className = 'size-4' }: IconProps) {
  return <FiPlus className={className} aria-hidden="true" />;
}

export function InfoCircleIcon({ className = 'size-4' }: IconProps) {
  return <FiInfo className={className} aria-hidden="true" />;
}

export function EyeIcon({ className = 'size-4' }: IconProps) {
  return <FiEye className={className} aria-hidden="true" />;
}

export function EyeOffIcon({ className = 'size-4' }: IconProps) {
  return <FiEyeOff className={className} aria-hidden="true" />;
}

export function SpinnerIcon({ className = 'size-4' }: IconProps) {
  // Used for Button's `loading` state. `animate-spin` lives on the icon
  // itself (not applied by the caller) — respects prefers-reduced-motion
  // globally via app/globals.css, same as the hand-drawn version this
  // replaced.
  return <FiLoader className={`${className} animate-spin`} aria-hidden="true" />;
}

// --- Reservations module (ref p10 card, p20-24 headers) ---

/** Availability Calendar (ref p10 card, p21 header). */
export function CalendarIcon({ className = 'size-4' }: IconProps) {
  return <FiCalendar className={className} aria-hidden="true" />;
}

/** Create Reservation (ref p10 card, p22 header) — adding a guest. */
export function CreateReservationIcon({ className = 'size-4' }: IconProps) {
  return <FaUserPlus className={className} aria-hidden="true" />;
}

/** Modify Reservation (ref p10 card, p23 header) — editing. */
export function ModifyReservationIcon({ className = 'size-4' }: IconProps) {
  return <FiEdit3 className={className} aria-hidden="true" />;
}

/** Cancel Reservation (ref p10 card, p24 header) — a calendar with an X. */
export function CancelReservationIcon({ className = 'size-4' }: IconProps) {
  return <FaCalendarTimes className={className} aria-hidden="true" />;
}

/** Waitlist Management (ref p10 card) — a clock, for "waiting". */
export function WaitlistIcon({ className = 'size-4' }: IconProps) {
  return <FaClock className={className} aria-hidden="true" />;
}

// --- Housekeeping module (ref p27 card, p28-31 headers) ---

/** Task Board (ref p27 card, p28 header). */
export function TaskBoardIcon({ className = 'size-4' }: IconProps) {
  return <FaTasks className={className} aria-hidden="true" />;
}

/** Staff Assignment (ref p27 card, p29 header). */
export function StaffAssignmentIcon({ className = 'size-4' }: IconProps) {
  return <FaUsers className={className} aria-hidden="true" />;
}

/** Inspection Workflow (ref p27 card, p30 header) — a clipboard with a check, for "approved". */
export function InspectionIcon({ className = 'size-4' }: IconProps) {
  return <FaClipboardCheck className={className} aria-hidden="true" />;
}

/** Room Blocking / OOO (ref p27 card, p31 header) — a "no entry" glyph. */
export function RoomBlockingIcon({ className = 'size-4' }: IconProps) {
  return <FaBan className={className} aria-hidden="true" />;
}
