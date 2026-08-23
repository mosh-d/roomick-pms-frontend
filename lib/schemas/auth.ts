import { z } from 'zod';

/**
 * Mirrors roomick-pms-backend/src/modules/auth/dto/register.dto.ts field
 * for field (including its exact constraints — min/max lengths, the
 * password rule) so client-side validation rejects the same inputs the
 * server would, before a round-trip. Kept in sync by hand (no shared-types
 * package between the two repos yet) — if the DTO changes, this needs a
 * matching edit. No `subdomain` field — the DTO no longer has one either;
 * `Tenant.subdomain` is generated server-side now (see that DTO's own
 * comment).
 *
 * One deliberate exception: the DTO's `name` is a single field, but the UI
 * reference (Owner Account Form) shows separate First Name/Last Name
 * inputs — split here for the form, joined back into one `name` string in
 * RegisterForm's submit handler right before the API call. The DTO itself
 * isn't changing; this is presentation only.
 */
export const registerSchema = z.object({
  groupName: z.string().trim().min(2, 'Required').max(200),
  // Max 99 each, not 100 — combined with the joining space, guarantees the
  // backend's 200-char `name` limit can never be exceeded (100+1+100=201).
  firstName: z.string().trim().min(1, 'Required').max(99),
  lastName: z.string().trim().min(1, 'Required').max(99),
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(320),
  // class-validator's @IsStrongPassword({ minSymbols: 0 }) — a symbol is
  // welcome but never required, matched here with the same 3 regex checks.
  password: z
    .string()
    .min(8, 'At least 8 characters')
    .regex(/[a-z]/, 'Needs a lowercase letter')
    .regex(/[A-Z]/, 'Needs an uppercase letter')
    .regex(/[0-9]/, 'Needs a number'),
  phone: z.string().trim().max(20).optional().or(z.literal('')),
  // ISO 3166-1 alpha-2, matches RegisterDto's optional `country` (reporting
  // only for now — see auth/dto/register.dto.ts).
  country: z.string().length(2).optional().or(z.literal('')),
});

export type RegisterFormValues = z.infer<typeof registerSchema>;

/** Mirrors verify-email.dto.ts — `token` is a JWT (class-validator's @IsJWT()), not a 6-digit OTP. */
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Required'),
});

export type VerifyEmailFormValues = z.infer<typeof verifyEmailSchema>;

/** Mirrors login.dto.ts's LoginDto — plain email+password, no subdomain (see that DTO's own comment: email is globally unique now, so it alone resolves the account). */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email').max(320),
  password: z.string().min(1, 'Required'),
});

export type LoginFormValues = z.infer<typeof loginSchema>;
