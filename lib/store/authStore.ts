import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { apiFetch } from '../api';

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  roles: Array<{ branchId: string | null; role: string }>;
}

type LoginResult = { accessToken: string; refreshToken: string; user: AuthUser };

interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  login: (email: string, password: string, subdomain: string) => Promise<LoginResult>;
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
  clear: () => void;
}

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
      async login(email, password, subdomain) {
        const result = await apiFetch<LoginResult>('/auth/login', {
          method: 'POST',
          body: { email, password, subdomain },
        });
        set({ accessToken: result.accessToken, refreshToken: result.refreshToken, user: result.user });
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
          set({ accessToken: null, refreshToken: null, user: null });
          return null;
        }
      },
      clear: () => set({ accessToken: null, refreshToken: null, user: null }),
    }),
    { name: 'roomick-auth' },
  ),
);
