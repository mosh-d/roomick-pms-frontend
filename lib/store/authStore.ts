import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiFetch } from '../api';
import { announceSessionEnded, clearIdleClock, hasBeenIdleTooLong, startIdleClock } from '../session';

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  roles: Array<{ branchId: string | null; role: string }>;
}

type LoginResult = { accessToken: string; refreshToken: string; user: AuthUser };

/**
 * What a correct password gets when two-step sign-in is on: no session yet,
 * just a five-minute ticket to send back with an authenticator code.
 */
export type MfaChallenge = { mfaRequired: true; challengeToken: string; expiresInSeconds: number };

export type MfaLoginResult = LoginResult & { secondFactor: 'totp' | 'recovery'; recoveryCodesLeft: number };

export function isMfaChallenge(result: LoginResult | MfaChallenge): result is MfaChallenge {
  return 'mfaRequired' in result && result.mfaRequired === true;
}

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  /**
   * Which branch/property the signed-in user picked, if their roles span
   * more than one (see `app/login/_components/BranchPicker.tsx`) — `null`
   * until an actual pick happens; there is deliberately no auto-selection
   * for the 0-or-1-branch case. Reset on every fresh `login()` and on
   * `clear()` (never on `refreshAccessToken()`, which re-authenticates the
   * *same* session, not a new one) — this store persists to localStorage,
   * so a stale branch id from a previous login would otherwise silently
   * carry into a different one.
   */
  activeBranchId: string | null;
  setActiveBranchId: (branchId: string) => void;
  /** Signs in, or — when two-step sign-in is on — returns the challenge and stores nothing yet. */
  login: (email: string, password: string) => Promise<LoginResult | MfaChallenge>;
  /** The second step: the ticket from `login` plus an authenticator or recovery code. */
  verifyMfa: (challengeToken: string, code: string) => Promise<MfaLoginResult>;
  /**
   * Exchanges the stored refresh token for a fresh pair via `POST
   * /auth/refresh` (backend: `auth.controller.ts`) and writes it back to
   * the store. Returns the new access token, or `null` if there's no
   * refresh token to use or the backend rejects it (expired/revoked) —
   * callers treat `null` as "the session is actually over," not retryable.
   * Failure also clears the store, same as `clear()`: a rejected refresh
   * means every other stored credential is stale too.
   */
  refreshAccessToken: () => Promise<string | null>;
  /**
   * The session ended mid-work — idle for an hour, or renewal refused. Kept
   * in memory only (never persisted): the page stays on screen under the
   * "session has ended" prompt instead of vanishing, and the next load
   * starts signed out regardless.
   */
  sessionEnded: boolean;
  /** Set by `logout()` only, so the sign-in page a sign-out lands on doesn't carry `?next=` — the next person at this computer shouldn't be taken to where the last one was. */
  signedOut: boolean;
  endSession: () => void;
  /** Signing out: ends the session on the server too (best effort), then forgets it here. */
  logout: () => Promise<void>;
  /** Forgets the session after it ended — the "Sign in again" on the ended prompt; the sign-in page then brings you back here. */
  leaveEndedSession: () => Promise<void>;
  clear: () => void;
}

/** Best effort: the server ends the session behind a refresh token. A failure changes nothing — the browser forgets it either way. */
async function revokeOnServer(refreshToken: string | null): Promise<void> {
  if (!refreshToken) return;
  try {
    await apiFetch('/auth/logout', { method: 'POST', body: { refreshToken } });
  } catch {
    // Offline, or already over.
  }
}

const SIGNED_OUT = { accessToken: null, refreshToken: null, user: null, activeBranchId: null };

/**
 * The first real Zustand store in this app (installed since Phase 1, unused
 * until now — see PHASE_NOTES.md). It exists because the onboarding wizard
 * (app/signup/_steps/) needs `accessToken`/tenantId to survive across
 * several sequential step components without prop-drilling two values
 * through every one of them.
 *
 * Now persisted (localStorage) — a reversal of this store's original
 * decision, made deliberately, not accidentally: an in-progress onboarding
 * wizard losing its session on an accidental page refresh was reported as
 * a real "I got stuck" bug (see wizardStore.ts, which the same reload
 * needs to survive too — a persisted draft with no session to submit it
 * with wouldn't fix anything). The XSS-exposure trade-off this originally
 * avoided is still real and still unresolved — a proper session strategy
 * (httpOnly refresh cookie vs. rotating memory-only access token, etc.) is
 * still an open item, not decided by this change. This is a bounded,
 * pragmatic call for the current MVP/onboarding-only scope, not a verdict
 * on how session storage should work once there's a full authenticated
 * app past `/signup` to protect.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      activeBranchId: null,
      setActiveBranchId: (branchId) => set({ activeBranchId: branchId }),
      async login(email, password) {
        const result = await apiFetch<LoginResult | MfaChallenge>('/auth/login', {
          method: 'POST',
          body: { email, password },
        });
        // A challenge isn't a session: nothing is stored until the code is right.
        if (isMfaChallenge(result)) return result;
        set({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.user,
          activeBranchId: null,
          sessionEnded: false,
          signedOut: false,
        });
        startIdleClock();
        return result;
      },
      async verifyMfa(challengeToken, code) {
        const result = await apiFetch<MfaLoginResult>('/auth/mfa/verify', {
          method: 'POST',
          body: { challengeToken, code },
        });
        set({
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          user: result.user,
          activeBranchId: null,
          sessionEnded: false,
          signedOut: false,
        });
        startIdleClock();
        return result;
      },
      async refreshAccessToken() {
        const { refreshToken } = get();
        if (!refreshToken) return null;
        try {
          const result = await apiFetch<LoginResult>('/auth/refresh', {
            method: 'POST',
            body: { refreshToken },
          });
          set({ accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user });
          return result.accessToken;
        } catch {
          // A refresh token works once now. Another tab may have just
          // renewed with this same one — if it stored a newer pair, carry on
          // with that instead of ending a session that's still alive.
          await useAuthStore.persist.rehydrate();
          const latest = get();
          if (latest.refreshToken && latest.refreshToken !== refreshToken && latest.accessToken) return latest.accessToken;
          get().endSession();
          return null;
        }
      },
      sessionEnded: false,
      signedOut: false,
      endSession: () => {
        if (get().sessionEnded) return;
        set({ sessionEnded: true });
        announceSessionEnded();
      },
      async logout() {
        const { refreshToken } = get();
        set({ ...SIGNED_OUT, sessionEnded: false, signedOut: true });
        clearIdleClock();
        await revokeOnServer(refreshToken);
      },
      async leaveEndedSession() {
        const { refreshToken } = get();
        set({ ...SIGNED_OUT, sessionEnded: false, signedOut: false });
        clearIdleClock();
        await revokeOnServer(refreshToken);
      },
      clear: () => {
        set({ ...SIGNED_OUT, sessionEnded: false });
        clearIdleClock();
      },
    }),
    {
      name: 'roomick-auth',
      // Only the session itself is saved — never whether it ended or was signed out, which belong to this page load.
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        activeBranchId: state.activeBranchId,
      }),
      // Opening Roomick after an hour or more away is the same as being idle
      // that long mid-work: the session is over before anything can renew it
      // (the Five Clover PMS's rule — a session from the day before used to
      // open straight in). Silent here; the sign-in page is where you land.
      onRehydrateStorage: () => (state) => {
        if (!state?.user || !hasBeenIdleTooLong()) return;
        const { refreshToken } = state;
        state.clear();
        void revokeOnServer(refreshToken);
      },
    },
  ),
);
