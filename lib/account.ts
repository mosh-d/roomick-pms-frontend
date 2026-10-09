import { z } from 'zod';
import { apiFetch } from './api';
import type { LoginResult } from './store/authStore';

/**
 * Getting into an account and back into it: accepting a staff invitation,
 * "forgot your password?", choosing a new one, and confirming an email.
 * Plain calls rather than query hooks — each is one step of a page's own
 * flow, run once on a button press.
 */

/** The sign-up rule, shared by every page where a new password is chosen. Mirrors the API's `STRONG_PASSWORD`. */
export const newPasswordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[a-z]/, 'Needs a lowercase letter')
  .regex(/[A-Z]/, 'Needs an uppercase letter')
  .regex(/[0-9]/, 'Needs a number');

/** Mirrors `InvitePreview` (roomick-pms-backend/src/modules/auth/auth.service.ts). */
export interface InvitePreview {
  email: string;
  organisation: string;
  branch: string | null;
  role: string;
  expiresAt: string;
  /** This email already has an account here — they give its password rather than choose one. */
  existingAccount: boolean;
}

/** Someone with an account here accepted: the role is theirs, and they sign in as usual. */
export type InviteJoined = { joined: true; email: string };

export function previewInvite(token: string): Promise<InvitePreview> {
  return apiFetch<InvitePreview>(`/auth/invites/${encodeURIComponent(token)}`);
}

export function acceptInvite(token: string, body: { name?: string; password: string; phone?: string }): Promise<LoginResult | InviteJoined> {
  // Through the web app's own address: a new account comes back signed in, its session in a cookie (see api.ts).
  return apiFetch<LoginResult | InviteJoined>(`/auth/accept-invite/${encodeURIComponent(token)}`, { method: 'POST', session: true, body });
}

export function isInviteJoined(result: LoginResult | InviteJoined): result is InviteJoined {
  return 'joined' in result && result.joined === true;
}

/** `emailEnabled: false` — no email provider is set up, so no link can be sent; a manager or the owner makes one instead. */
export function requestPasswordReset(email: string): Promise<{ emailEnabled: boolean }> {
  return apiFetch<{ emailEnabled: boolean }>('/auth/forgot-password', { method: 'POST', body: { email } });
}

export function resetPassword(token: string, password: string): Promise<{ reset: true }> {
  return apiFetch<{ reset: true }>('/auth/reset-password', { method: 'POST', body: { token, password } });
}

export function verifyEmail(token: string): Promise<{ verified: true }> {
  return apiFetch<{ verified: true }>('/auth/verify-email', { method: 'POST', body: { token } });
}

/**
 * "Send the link again". With email set up it goes by email; without, the
 * account's own password gets the token back to confirm with straight away
 * (the same shortcut sign-up uses).
 */
export function resendVerification(email: string, password?: string): Promise<{ emailEnabled: boolean; verificationToken: string | null }> {
  return apiFetch<{ emailEnabled: boolean; verificationToken: string | null }>('/auth/resend-verification', { method: 'POST', body: { email, password } });
}

type AuthOpts = { accessToken: string | undefined; tenantId: string | undefined };

/** Ends every other session; the new one it returns (its cookie included) carries this one on. */
export function changePassword(body: { currentPassword: string; newPassword: string }, { accessToken, tenantId }: AuthOpts): Promise<LoginResult> {
  return apiFetch<LoginResult>('/auth/change-password', { method: 'POST', session: true, accessToken, tenantId, body });
}
