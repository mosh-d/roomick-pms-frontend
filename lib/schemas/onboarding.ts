import { z } from 'zod';

/** Mirrors tenants/dto/configure-mode.dto.ts. `brandName` is optional in single mode too — the backend defaults it to the tenant's groupName when omitted. */
export const configureModeSchema = z.object({
  mode: z.enum(['single', 'multi']),
  brandName: z.string().trim().min(2, 'At least 2 characters').max(200).optional().or(z.literal('')),
});

export type ConfigureModeFormValues = z.infer<typeof configureModeSchema>;

/** Mirrors property/dto/brand.dto.ts's CreateBrandDto — name only; logoUrl/primaryColor/defaultPolicies are brand-management work, not onboarding. */
export const createBrandSchema = z.object({
  name: z.string().trim().min(2, 'At least 2 characters').max(200),
});

export type CreateBrandFormValues = z.infer<typeof createBrandSchema>;

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
  // otherwise breaks RHF's <T> inference; see RoomsForm/roomsBulkSchema).
  baseRate: z.number().positive('Must be greater than 0'),
  adults: z.number().int().min(1).max(20),
  children: z.number().int().min(0).max(20),
  bedType: z.string().trim().max(50).optional().or(z.literal('')),
  amenities: z.array(z.string()).optional(),
});

export type RoomTypeFormValues = z.infer<typeof roomTypeSchema>;

/**
 * Mirrors property/dto/rooms.dto.ts's BulkCreateRoomsDto — the `range`
 * variant only (numeric from/to, e.g. 301-320). The DTO also supports an
 * explicit `numbers` array; not built here, same MVP-scoping reasoning as
 * skipping buildings/floors (see PHASE_NOTES.md) — the range path covers
 * the common case and floorId is intentionally omitted (the backend
 * auto-creates a hidden default building/floor, its own documented "Rooms
 * Only" onboarding mode).
 */
export const roomsBulkSchema = z
  .object({
    // Plain z.number() — see roomTypeSchema's comment on why not z.coerce.number().
    from: z.number().int().min(0),
    to: z.number().int().min(0).max(99999),
    prefix: z.string().trim().max(10).optional().or(z.literal('')),
    view: z.string().trim().max(50).optional().or(z.literal('')),
  })
  .refine((data) => data.to >= data.from, { message: 'Must be ≥ the starting number', path: ['to'] });

export type RoomsBulkFormValues = z.infer<typeof roomsBulkSchema>;
