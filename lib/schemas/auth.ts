import { z } from 'zod';

/**
 * Mirrors roomick-pms-backend/src/modules/auth/dto/register.dto.ts field
 * for field (including its exact constraints — min/max lengths, the
 * subdomain regex, the password rule) so client-side validation rejects
 * the same inputs the server would, before a round-trip. Kept in sync by
 * hand (no shared-types package between the two repos yet) — if the DTO
 * changes, this needs a matching edit.
 */
export const registerSchema = z.object({
  subdomain: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'At least 3 characters')
    .max(63, 'At most 63 characters')
    .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/, 'Lowercase letters, numbers, and inner hyphens only'),
  groupName: z.string().trim().min(2, 'Required').max(200),
  name: z.string().trim().min(2, 'Required').max(200),
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
});

export type RegisterFormValues = z.infer<typeof registerSchema>;

/** Mirrors verify-email.dto.ts — `token` is a JWT (class-validator's @IsJWT()), not a 6-digit OTP. */
export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Required'),
});

export type VerifyEmailFormValues = z.infer<typeof verifyEmailSchema>;
