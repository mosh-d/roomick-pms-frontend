import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ApiError, apiFetch } from '../api';
import { announceSessionEnded, clearIdleClock, hasBeenIdleTooLong, startIdleClock } from '../session';

export type SessionEndReason = 'idle' | 'suspended';

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  roles: Array<{ branchId: string | null; role: string }>;
}

/**
 * A session as the API hands it to the browser: the access token and who it
 * is. The refresh token never reaches this page — the API keeps it in an
 * httpOnly cookie no script can read (see `SESSION_BASE_URL` in api.ts).
 */
export type LoginResult = { accessToken: string; user: AuthUser };

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
  /** In this page's memory only — never saved. A reload gets a fresh one from the session cookie (`restoreSession`). */
  accessToken: string | null;
  /**
   * A refresh token saved by a version of Roomick from before the session
   * cookie (it kept both tokens in localStorage). Traded once for the cookie
   * on the first renewal, then gone; never saved again.
   */
  legacyRefreshToken: string | null;
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
   * A session the API handed over some other way: accepting an invitation
   * (a fresh sign-in), or changing your password (`keepBranch` — the same
   * person carrying on with the same work, every other session now ended).
   * The API put the new session in the cookie, and ended the one it replaced.
   */
  adoptSession: (result: LoginResult, options?: { keepBranch?: boolean }) => void;
  /**
   * Renews the session in the cookie via `POST /auth/refresh` (backend:
   * `auth.controller.ts`) mid-work, after a 401. Returns the new access
   * token, or `null` — the request that needed it fails. When the session
   * is really over (not just the API out of reach) the page shows the
   * "session has ended" prompt too.
   */
  refreshAccessToken: () => Promise<string | null>;
  /**
   * The page was loaded (or reloaded) by someone signed in: there's no
   * access token in memory yet, so one is fetched from the session cookie
   * before any page asks for data. `restoring` is true meanwhile.
   */
  restoreSession: () => Promise<void>;
  restoring: boolean;
  /** The API couldn't be reached to restore the session (offline, say) — the person is still signed in; `restoreSession` tries again. */
  restoreFailed: boolean;
  /**
   * The session ended mid-work — idle for an hour, or renewal refused. Kept
   * in memory only (never persisted): the page stays on screen under the
   * "session has ended" prompt instead of vanishing, and the next load
   * starts signed out regardless.
   */
  sessionEnded: boolean;
  /** Why: an hour away, or the organisation was suspended while someone was signed in. */
  sessionEndedReason: SessionEndReason | null;
  /** Set by `logout()` only, so the sign-in page a sign-out lands on doesn't carry `?next=` — the next person at this computer shouldn't be taken to where the last one was. */
  signedOut: boolean;
  endSession: (reason?: SessionEndReason) => void;
  /** Signing out: ends the session on the server too (best effort), then forgets it here. */
  logout: () => Promise<void>;
  /** Forgets the session after it ended — the "Sign in again" on the ended prompt; the sign-in page then brings you back here. */
  leaveEndedSession: () => Promise<void>;
  clear: () => void;
}

/** Best effort: the server ends the session in the cookie (and a leftover saved token's). A failure changes nothing — the browser forgets it either way. */
async function revokeOnServer(legacyRefreshToken: string | null): Promise<void> {
  try {
    await apiFetch('/auth/logout', { method: 'POST', session: true, body: legacyRefreshToken ? { refreshToken: legacyRefreshToken } : {} });
  } catch {
    // Offline, or already over.
  }
}

/**
 * One renewal at a time across every tab of this browser. They share one
 * cookie, and a refresh token works once: two tabs renewing at the same
 * moment would send the same one, and the second would be refused. With the
 * lock, the second waits and then sends the cookie the first one got back.
 */
async function oneTabAtATime<T>(work: () => Promise<T>): Promise<T> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  return locks ? await locks.request('roomick-session-renewal', work) : await work();
}

type Renewal = { kind: 'renewed'; result: LoginResult } | { kind: 'ended'; suspended: boolean } | { kind: 'unreachable' };

/**
 * Exchanges the session cookie (or a token saved by an older version) for a
 * fresh access token. A refusal is retried once a moment later, with the
 * cookie alone: a browser without the lock above may have had another tab
 * renew in the same instant, and the browser now holds that tab's newer
 * cookie.
 */
async function renew(legacyRefreshToken: string | null): Promise<Renewal> {
  const attempt = (legacy: string | null) =>
    apiFetch<LoginResult>('/auth/refresh', { method: 'POST', session: true, body: legacy ? { refreshToken: legacy } : {} });
  return oneTabAtATime(async () => {
    try {
      return { kind: 'renewed', result: await attempt(legacyRefreshToken) };
    } catch (first) {
      if (!(first instanceof ApiError) || first.status >= 500 || first.status === 429) return { kind: 'unreachable' };
      if (first.status === 403) return { kind: 'ended', suspended: first.isCode('TENANT_SUSPENDED') };
      await new Promise((resolve) => setTimeout(resolve, 300));
      try {
        return { kind: 'renewed', result: await attempt(null) };
      } catch (second) {
        if (!(second instanceof ApiError) || second.status >= 500 || second.status === 429) return { kind: 'unreachable' };
        return { kind: 'ended', suspended: second.isCode('TENANT_SUSPENDED') };
      }
    }
  });
}

const SIGNED_OUT = { accessToken: null, legacyRefreshToken: null, user: null, activeBranchId: null };

/**
 * The renewal in flight, if any. A page opened after the access token ran
 * out fires all its requests at once and each meets a 401; they now wait on
 * one renewal instead of each spending the single-use refresh token — nine
 * at once used to send nine renewals, one accepted and eight refused, and
 * only the order the answers came back in kept the session alive.
 */
let renewing: Promise<string | null> | null = null;
let restoring: Promise<void> | null = null;

/**
 * The first real Zustand store in this app. It exists because the
 * onboarding wizard (app/signup/_steps/) needs `accessToken`/tenantId to
 * survive across several sequential step components without prop-drilling
 * two values through every one of them.
 *
 * Persisted to localStorage — but only who is signed in and which branch they
 * picked, never a token. The sign-in tokens used to be saved here too, where
 * any script that got onto the page could read them (and a refresh token is
 * good for a week). Now the refresh token lives in an httpOnly cookie no
 * script can read, and the access token only in memory: a reload — an
 * accidental one in the middle of the onboarding wizard included — gets a
 * fresh access token from the cookie (`restoreSession`), so nothing is lost.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      legacyRefreshToken: null,
      user: null,
      activeBranchId: null,
      setActiveBranchId: (branchId) => set({ activeBranchId: branchId }),
      async login(email, password) {
        const result = await apiFetch<LoginResult | MfaChallenge>('/auth/login', {
          method: 'POST',
          session: true,
          body: { email, password },
        });
        // A challenge isn't a session: nothing is stored until the code is right.
        if (isMfaChallenge(result)) return result;
        set({
          accessToken: result.accessToken,
          legacyRefreshToken: null,
          user: result.user,
          activeBranchId: null,
          restoreFailed: false,
          sessionEnded: false,
          sessionEndedReason: null,
          signedOut: false,
        });
        startIdleClock();
        return result;
      },
      async verifyMfa(challengeToken, code) {
        const result = await apiFetch<MfaLoginResult>('/auth/mfa/verify', {
          method: 'POST',
          session: true,
          body: { challengeToken, code },
        });
        set({
          accessToken: result.accessToken,
          legacyRefreshToken: null,
          user: result.user,
          activeBranchId: null,
          restoreFailed: false,
          sessionEnded: false,
          sessionEndedReason: null,
          signedOut: false,
        });
        startIdleClock();
        return result;
      },
      adoptSession(result, options) {
        set({
          accessToken: result.accessToken,
          legacyRefreshToken: null,
          user: result.user,
          ...(options?.keepBranch ? {} : { activeBranchId: null }),
          restoreFailed: false,
          sessionEnded: false,
          sessionEndedReason: null,
          signedOut: false,
        });
        startIdleClock();
      },
      refreshAccessToken() {
        // Signed out: a request still answering 401 afterwards doesn't start a
        // renewal — it would bring the session's cookie back.
        if (get().signedOut) return Promise.resolve(null);
        renewing ??= (async () => {
          const before = get().user;
          const outcome = await renew(get().legacyRefreshToken);
          // Signed out while the renewal was on its way: what it brought back isn't taken up.
          if (get().signedOut) return null;
          // Someone else signed in in another tab of this browser: the cookie
          // is theirs now. This page carries on as nobody, not as them.
          if (outcome.kind === 'renewed' && before && outcome.result.user.id !== before.id) {
            get().endSession();
            return null;
          }
          if (outcome.kind === 'renewed') {
            set({ accessToken: outcome.result.accessToken, legacyRefreshToken: null, user: outcome.result.user });
            return outcome.result.accessToken;
          }
          // The API out of reach isn't the session's end: this request fails,
          // and the next one tries the cookie again.
          if (outcome.kind === 'unreachable') return null;
          get().endSession(outcome.suspended ? 'suspended' : 'idle');
          return null;
        })().finally(() => {
          renewing = null;
        });
        return renewing;
      },
      restoring: false,
      restoreFailed: false,
      restoreSession() {
        restoring ??= (async () => {
          if (!get().user || get().accessToken) return;
          set({ restoring: true, restoreFailed: false });
          // A blip in the connection isn't the end of a session: a few tries
          // before saying the API can't be reached (still signed in).
          for (const wait of [0, 1_000, 3_000]) {
            if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
            const outcome = await renew(get().legacyRefreshToken);
            if (get().signedOut) {
              set({ restoring: false });
              return;
            }
            if (outcome.kind === 'renewed') {
              set({ accessToken: outcome.result.accessToken, legacyRefreshToken: null, user: outcome.result.user, restoring: false });
              return;
            }
            if (outcome.kind === 'ended') {
              // Over: the sign-in page, which brings them back here afterwards.
              set({ ...SIGNED_OUT, restoring: false });
              clearIdleClock();
              return;
            }
          }
          set({ restoring: false, restoreFailed: true });
        })().finally(() => {
          restoring = null;
        });
        return restoring;
      },
      sessionEnded: false,
      sessionEndedReason: null,
      signedOut: false,
      endSession: (reason: SessionEndReason = 'idle') => {
        if (get().sessionEnded) return;
        set({ sessionEnded: true, sessionEndedReason: reason });
        announceSessionEnded();
      },
      async logout() {
        const { legacyRefreshToken } = get();
        set({ ...SIGNED_OUT, restoreFailed: false, sessionEnded: false, sessionEndedReason: null, signedOut: true });
        clearIdleClock();
        // A renewal already on its way would set a fresh cookie after the
        // sign-out cleared it: let it land, then end the session under the
        // same lock as renewals, so no tab of this browser renews meanwhile
        // and the cookie the sign-out sends is the newest one.
        await renewing?.catch(() => null);
        await oneTabAtATime(() => revokeOnServer(legacyRefreshToken));
      },
      async leaveEndedSession() {
        const { legacyRefreshToken } = get();
        set({ ...SIGNED_OUT, restoreFailed: false, sessionEnded: false, sessionEndedReason: null, signedOut: false });
        clearIdleClock();
        await revokeOnServer(legacyRefreshToken);
      },
      clear: () => {
        set({ ...SIGNED_OUT, restoreFailed: false, sessionEnded: false });
        clearIdleClock();
      },
    }),
    {
      name: 'roomick-auth',
      // Who is signed in and where — never a token, nor whether the session ended or was signed out, which belong to this page load.
      partialize: (state) => ({
        user: state.user,
        activeBranchId: state.activeBranchId,
      }),
      // Only what this version saves is taken back — and a refresh token an
      // older version saved, to trade for the cookie once (an access token it
      // saved is simply dropped; the cookie gets a fresh one).
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as { user?: AuthUser | null; activeBranchId?: string | null; refreshToken?: string | null };
        return {
          ...current,
          user: saved.user ?? null,
          activeBranchId: saved.activeBranchId ?? null,
          legacyRefreshToken: typeof saved.refreshToken === 'string' ? saved.refreshToken : null,
        };
      },
      // Opening Roomick after an hour or more away is the same as being idle
      // that long mid-work: the session is over before anything can renew it
      // (the Five Clover PMS's rule — a session from the day before used to
      // open straight in). Silent here; the sign-in page is where you land.
      // Otherwise the session is brought back from the cookie straight away.
      onRehydrateStorage: () => (state) => {
        if (!state?.user) return;
        if (hasBeenIdleTooLong()) {
          const { legacyRefreshToken } = state;
          state.clear();
          void revokeOnServer(legacyRefreshToken);
          return;
        }
        void state.restoreSession();
      },
    },
  ),
);
