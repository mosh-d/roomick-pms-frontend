import { z } from 'zod';

// No zod schema for Organization Structure (single/multi-brand mode) — it's
// a single required radio choice (`OrgStructureForm` just checks `brandMode
// !== null`), and there's no separate "Brand Name" field to validate here
// anymore (see OrgStructureForm.tsx and PHASE_NOTES.md — it's collected once,
// at signup, and reused as the head brand's name for either mode). The
// actual `POST /tenants/configure-mode` call only fires once, as part of
// Review's "Finish" submission chain — see page.tsx.

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Mirrors property/dto/branch.dto.ts's CreateBranchDto + AddressDto field for field. */
export const branchSetupSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(200),
  street: z.string().trim().min(1, 'Required').max(300),
  city: z.string().trim().min(1, 'Required').max(100),
  state: z.string().trim().max(100).optional().or(z.literal('')),
  country: z
    .string()
    .trim()
    .toUpperCase()
    .length(2, 'ISO 3166-1 alpha-2, e.g. NG, US, GB'),
  zip: z.string().trim().max(20).optional().or(z.literal('')),
  timezone: z.string().trim().min(1, 'Required').max(50),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{3}$/, '3-letter ISO 4217 code, e.g. NGN, USD'),
  checkInTime: z.string().regex(TIME_RE, 'HH:mm').optional().or(z.literal('')),
  checkOutTime: z.string().regex(TIME_RE, 'HH:mm').optional().or(z.literal('')),
  category: z.enum(['hotel', 'resort', 'motel', 'boutique', 'hostel']).optional().or(z.literal('')),
});

export type BranchSetupFormValues = z.infer<typeof branchSetupSchema>;

/** Mirrors property/dto/room-type.dto.ts's CreateRoomTypeDto + CapacityDto. */
export const roomTypeSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(100),
  // RHF's `valueAsNumber: true` (see RoomTypeForm) converts the native
  // number input's string value before this schema ever sees it — plain
  // z.number(), not z.coerce.number(), so useForm's generic and the
  // resolver's inferred type agree (coerce's input/output type split
  // otherwise breaks RHF's <T> inference; see setupPatternSchema below).
  baseRate: z.number().positive('Must be greater than 0'),
  adults: z.number().int().min(1).max(20),
  children: z.number().int().min(0).max(20),
  bedType: z.string().trim().max(50).optional().or(z.literal('')),
  sizeM2: z.number().positive().optional(),
  amenities: z.array(z.string()).optional(),
});

export type RoomTypeFormValues = z.infer<typeof roomTypeSchema>;

/**
 * Mirrors property/dto/structure.dto.ts's CreateBuildingDto + CreateFloorDto
 * — one building at a time (`BuildingsFloorsForm`'s "+ Add building" stacks
 * another). Floors are a plain count (`CreateFloorDto.floorNumber` is just
 * an int, `label` optional and unused here), not individually authored —
 * matches the reference mockup exactly: a "Number of floors" stepper, no
 * per-floor name field anywhere. `isMultiFloor: false` means exactly one
 * floor (floorNumber 0), skipping the stepper.
 */
export const buildingSchema = z.object({
  name: z.string().trim().min(1, 'Required').max(100),
  isMultiFloor: z.boolean(),
  floorCount: z.number().int().min(1).max(200),
  views: z.array(z.string()).optional(),
});

export type BuildingFormValues = z.infer<typeof buildingSchema>;

/** One room card in `RoomsForm`'s list — `roomTypeLocalId` refs a `RoomTypeDraft` already configured for this branch, not a real backend id yet. */
export const roomCardSchema = z.object({
  roomTypeLocalId: z.string().min(1, 'Choose a room type'),
  number: z.string().trim().min(1, 'Required').max(20),
  view: z.string().trim().max(50).optional().or(z.literal('')),
});

export type RoomCardFormValues = z.infer<typeof roomCardSchema>;

/**
 * The "Setup Pattern" modal (`RoomsForm`'s "Generate") — computes a batch of
 * `RoomCardDraft`s client-side rather than calling the backend directly
 * (still deferred submission, same as everything else from Organization
 * Structure onward). `startingNumber` is numeric, not the free-text
 * `Room.number` shape the rest of this app uses — an increment *pattern*
 * (+1, +2, ...) only makes sense arithmetically, so this field is
 * deliberately narrower than a general room number.
 */
export const setupPatternSchema = z.object({
  roomTypeLocalId: z.string().min(1, 'Choose a room type'),
  startingNumber: z.number().int().min(0),
  count: z.number().int().min(1).max(500),
  increment: z.number().int().min(1).max(100),
  view: z.string().trim().max(50).optional().or(z.literal('')),
});

export type SetupPatternFormValues = z.infer<typeof setupPatternSchema>;

/** Mirrors users/dto/bulk-invite.dto.ts's BulkInviteDto + InviteRowDto. roleId comes from GET /auth/roles, not a free-text role name. */
export const staffInviteSchema = z.object({
  invites: z
    .array(
      z.object({
        email: z.string().trim().toLowerCase().email('Enter a valid email').max(320),
        roleId: z.string().min(1, 'Choose a role'),
      }),
    )
    .min(1)
    .max(50),
});

export type StaffInviteFormValues = z.infer<typeof staffInviteSchema>;
