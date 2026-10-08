// 127.0.0.1, not localhost: on Windows `localhost` resolves to ::1 first, and another
// project's dev server bound on IPv6 port 3000 answers instead of Roomick's API (which binds
// IPv4) — the browser then reports a CORS error that has nothing to do with CORS.
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3000/api/v1';

/**
 * Mirrors the backend's stable error codes exactly
 * (roomick-pms-backend/src/common/errors/error-codes.ts) — kept as a
 * literal union, not imported, since the two are separate npm packages/
 * repos with no shared-types package (yet). If this drifts out of sync,
 * the fallback in `ApiError.isCode` (a plain string compare) still works;
 * only the autocomplete/typo-checking benefit is lost.
 */
export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL'
  | 'NOT_IMPLEMENTED'
  | 'TENANT_HEADER_MISSING'
  | 'TENANT_MISMATCH'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_VERIFIED'
  | 'TOKEN_INVALID'
  | 'SUBDOMAIN_TAKEN'
  | 'EMAIL_TAKEN'
  | 'INVITE_INVALID'
  | 'BRAND_MODE_ALREADY_CONFIGURED'
  | 'BRAND_LIMIT_SINGLE_MODE'
  | 'INVALID_TIMEZONE'
  | 'BRANCH_NAME_TAKEN'
  | 'ROOM_NUMBERS_TAKEN'
  | 'INVALID_STATUS_TRANSITION'
  | 'RESERVATION_NOT_AVAILABLE'
  | 'OVERBOOKING_NOT_ACKNOWLEDGED'
  | 'CANCELLATION_TERMS_CHANGED'
  | 'FOLIO_NOT_SETTLED'
  | 'AUDIT_ALREADY_RAN'
  | 'TOO_MANY_REQUESTS'
  | 'SHIFT_REQUIRED'
  | 'EARLY_CHECK_IN'
  | 'TENANT_SUSPENDED'
  | 'PAYLOAD_TOO_LARGE'
  | 'FOLIO_CREDIT_BALANCE';

/**
 * The backend's global ProblemJsonExceptionFilter always returns this shape
 * (RFC 9457 application/problem+json), whether the failure is a validation
 * error, a domain conflict, or an unexpected 500 — internals are never
 * leaked (backend spec §6). `errors` is only present for class-validator
 * failures (an array of message strings).
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | string;
  readonly errors?: unknown;

  constructor(status: number, code: string, detail: string, errors?: unknown) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.errors = errors;
  }

  isCode(code: ApiErrorCode): boolean {
    return this.code === code;
  }
}

type ApiFetchOptions = Omit<RequestInit, 'body'> & {
  body?: unknown;
  tenantId?: string;
  accessToken?: string;
  /** Internal only — set by apiFetch's own 401 retry so it can't loop forever if the refreshed token *also* comes back unauthorized. Callers never pass this. */
  _isRetry?: boolean;
};

/**
 * Thin fetch wrapper — not a full client library, since only a handful of
 * endpoints are wired up so far (see PHASE_NOTES.md). Every backend route
 * lives under /api/v1 (global prefix + URI versioning, see main.ts), so
 * `path` here is relative to that, e.g. `apiFetch('/auth/register', ...)`.
 *
 * A 401 on a call that *did* carry an access token gets exactly one
 * transparent retry: refresh via `authStore.refreshAccessToken()` (which
 * exchanges the stored refresh token — single-use, a week's life — for a
 * new pair), then re-run the original request with the new token. Unless
 * the person has been idle for an hour: then the session ends instead. Real bug this fixes, not a
 * hypothetical: the access token's own TTL is 15 minutes
 * (`JWT_ACCESS_TTL=900s`), well under how long a multi-branch onboarding
 * wizard can reasonably take to fill in and review — every caller up to
 * now got a raw "Unauthorized" the moment that clock ran out, mid-review,
 * with no recovery but a fresh login. `authStore` is imported dynamically,
 * not at module top level: `authStore.ts` already imports `apiFetch` from
 * this file, so a static import here would be circular.
 */
/**
 * After a 401 on a call that carried a token: a renewed token, or `null`
 * when the session has ended. Renewed only for someone who's been working in
 * the last hour — a terminal left alone that long has its session ended
 * instead, however much the page itself has been polling (see
 * lib/session.ts).
 */
async function renewedToken(): Promise<string | null> {
  const { useAuthStore } = await import('./store/authStore');
  const { hasBeenIdleTooLong } = await import('./session');
  if (hasBeenIdleTooLong()) {
    useAuthStore.getState().endSession();
    return null;
  }
  return useAuthStore.getState().refreshAccessToken();
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, tenantId, accessToken, headers, _isRetry, ...rest } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && accessToken && !_isRetry) {
    const newToken = await renewedToken();
    if (newToken) {
      return apiFetch<T>(path, { ...options, accessToken: newToken, _isRetry: true });
    }
  }

  // 204 No Content and similar bodiless responses — nothing to parse.
  if (response.status === 204) return undefined as T;

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const problem = (data ?? {}) as { code?: string; detail?: string; errors?: unknown };
    // The organisation was suspended while someone was signed in: every call
    // is refused from now on, so the session ends with a plain explanation
    // instead of every page failing one request at a time.
    if (response.status === 403 && problem.code === 'TENANT_SUSPENDED' && accessToken) {
      const { useAuthStore } = await import('./store/authStore');
      useAuthStore.getState().endSession('suspended');
    }
    const fallback = response.status === 429 ? 'Too many attempts — try again in a minute.' : 'Something went wrong. Please try again.';
    throw new ApiError(response.status, problem.code ?? (response.status === 429 ? 'TOO_MANY_REQUESTS' : 'INTERNAL'), problem.detail ?? fallback, problem.errors);
  }

  return data as T;
}

/**
 * `apiFetch` always parses JSON, so binary downloads (PDF exports) go
 * through this instead — same base URL/auth headers, but reads a `Blob`
 * and triggers a normal browser save via a throwaway object URL, since an
 * `<a href>` alone can't carry the Authorization/X-Tenant-ID headers these
 * routes require.
 */
export async function downloadFile(
  path: string,
  filename: string,
  { accessToken, tenantId }: { accessToken?: string; tenantId?: string },
  /** A file built from a request body (the Custom Report Builder's CSV) is a POST. */
  post?: { body: unknown },
): Promise<void> {
  const request = (token: string | undefined) =>
    fetch(`${API_BASE_URL}${path}`, {
      method: post ? 'POST' : 'GET',
      headers: {
        ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(post ? { 'Content-Type': 'application/json' } : {}),
      },
      body: post ? JSON.stringify(post.body) : undefined,
    });
  let response = await request(accessToken);
  // The same one renewal `apiFetch` makes: a download was the first thing
  // many people did after a quiet quarter of an hour (the registration card
  // at check-in), and it failed with "Could not download the file".
  if (response.status === 401 && accessToken) {
    const newToken = await renewedToken();
    if (newToken) response = await request(newToken);
  }
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { code?: string; detail?: string } | null;
    throw new ApiError(response.status, problem?.code ?? 'INTERNAL', problem?.detail ?? 'Could not download the file.');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
