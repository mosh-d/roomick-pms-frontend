import { create } from 'zustand';
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
  clear: () => void;
}

/**
 * The first real Zustand store in this app (installed since Phase 1, unused
 * until now — see PHASE_NOTES.md). It exists because the onboarding wizard
 * (app/signup/_steps/) needs `accessToken`/tenantId to survive across
 * several sequential step components without prop-drilling two values
 * through every one of them.
 *
 * Deliberately NOT persisted (no `zustand/middleware` `persist`) — writing
 * a bearer JWT to localStorage before a real session strategy is decided
 * (still an open item, see PHASE_NOTES.md) would be choosing a security
 * posture by default rather than on purpose. In-memory only means a hard
 * refresh mid-wizard loses the session; that's an honest, visible
 * limitation (no `/login` page exists yet to recover from it either) rather
 * than a silent XSS-exposed token sitting in storage. Revisit once the
 * session strategy — httpOnly refresh cookie vs. rotating memory-only
 * access token, etc. — is actually decided.
 */
export const useAuthStore = create<AuthState>((set) => ({
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
  clear: () => set({ accessToken: null, refreshToken: null, user: null }),
}));
