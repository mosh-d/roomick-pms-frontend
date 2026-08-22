const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3000/api/v1';

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
  | 'ROOM_NUMBERS_TAKEN'
  | 'INVALID_STATUS_TRANSITION'
  | 'RESERVATION_NOT_AVAILABLE'
  | 'OVERBOOKING_NOT_ACKNOWLEDGED'
  | 'FOLIO_NOT_SETTLED'
  | 'AUDIT_ALREADY_RAN';

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
};

/**
 * Thin fetch wrapper — not a full client library, since only a handful of
 * endpoints are wired up so far (see PHASE_NOTES.md). Every backend route
 * lives under /api/v1 (global prefix + URI versioning, see main.ts), so
 * `path` here is relative to that, e.g. `apiFetch('/auth/register', ...)`.
 */
export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, tenantId, accessToken, headers, ...rest } = options;

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

  // 204 No Content and similar bodiless responses — nothing to parse.
  if (response.status === 204) return undefined as T;

  const data: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const problem = (data ?? {}) as { code?: string; detail?: string; errors?: unknown };
    throw new ApiError(
      response.status,
      problem.code ?? 'INTERNAL',
      problem.detail ?? 'Something went wrong. Please try again.',
      problem.errors,
    );
  }

  return data as T;
}
