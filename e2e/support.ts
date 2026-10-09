import type { Page } from '@playwright/test';

/**
 * Shared ground for the browser tests: the API they run against, an
 * organisation of their own (made and deleted through the API, the way the
 * backend's own end-to-end tests do it), and a watch on the page's API calls.
 */

export const API_URL = process.env.E2E_API_URL ?? 'http://127.0.0.1:3096/api/v1';

export interface Owner {
  email: string;
  password: string;
  tenantId: string;
  userId: string;
  /** Renewed by `api()` when it expires — the API under test signs in for 5 seconds. */
  token: string;
  refreshToken: string;
}

export interface Property {
  branchId: string;
  roomTypeId: string;
  roomIds: string[];
}

type Json = Record<string, unknown>;

/** One request to the API; as `owner`, an expired sign-in is renewed once and the request repeated. */
export async function api(method: string, path: string, options: { owner?: Owner; body?: unknown } = {}): Promise<{ status: number; json: Json }> {
  const send = async () => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (options.owner) {
      headers.Authorization = `Bearer ${options.owner.token}`;
      headers['X-Tenant-ID'] = options.owner.tenantId;
    }
    const res = await fetch(`${API_URL}${path}`, { method, headers, body: options.body === undefined ? undefined : JSON.stringify(options.body) });
    const text = await res.text();
    let json: Json = {};
    try {
      json = text ? (JSON.parse(text) as Json) : {};
    } catch {
      json = { text };
    }
    return { status: res.status, json };
  };
  const first = await send();
  if (first.status !== 401 || !options.owner) return first;
  await renew(options.owner);
  return send();
}

/** Swaps the owner's refresh token for a new pair, as the web app does. */
async function renew(owner: Owner): Promise<void> {
  const res = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: owner.refreshToken }) });
  if (res.status !== 200) throw new Error(`refresh ${res.status}`);
  const json = (await res.json()) as { accessToken: string; refreshToken: string };
  owner.token = json.accessToken;
  owner.refreshToken = json.refreshToken;
}

/** The Lagos calendar date `offsetDays` from today — the branches these tests make are in Lagos. */
export function lagosDay(offsetDays = 0): string {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Lagos' });
  return new Date(new Date(`${today}T00:00:00.000Z`).getTime() + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

/** Registers an organisation, confirms the email with the token a test API hands back, and signs in. */
export async function signUp(label: string): Promise<Owner> {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const email = `browser-${label.toLowerCase()}-${stamp}@example.com`;
  const password = 'Str0ngPass!1';
  const registered = await api('POST', '/auth/register', { body: { groupName: `Browser ${label} ${stamp}`, name: `${label} Owner`, email, password, isDemo: true } });
  if (registered.status !== 201) throw new Error(`register ${registered.status}: ${JSON.stringify(registered.json)}`);
  const token = registered.json.verificationToken;
  if (typeof token !== 'string') throw new Error('The API sent no verification token — run it with NODE_ENV other than production and no email provider');
  const verified = await api('POST', '/auth/verify-email', { body: { token } });
  if (verified.status !== 200) throw new Error(`verify ${verified.status}: ${JSON.stringify(verified.json)}`);
  return signIn(email, password);
}

export async function signIn(email: string, password: string): Promise<Owner> {
  const res = await api('POST', '/auth/login', { body: { email, password } });
  if (res.status !== 200) throw new Error(`login ${res.status}: ${JSON.stringify(res.json)}`);
  const user = res.json.user as { id: string; tenantId: string };
  return { email, password, tenantId: user.tenantId, userId: user.id, token: res.json.accessToken as string, refreshToken: res.json.refreshToken as string };
}

/** The head brand, one Lagos branch, a room type and `rooms` rooms numbered from 101. */
export async function addProperty(owner: Owner, rooms = 2): Promise<Property> {
  const configured = await api('POST', '/tenants/configure-mode', { owner, body: { mode: 'single' } });
  const brandId = (configured.json.brand as { id: string }).id;
  const branch = await api('POST', `/brands/${brandId}/branches`, {
    owner,
    body: { name: 'Browser Branch', address: { street: '1 Test Street', city: 'Lagos', country: 'NG' }, timezone: 'Africa/Lagos', currency: 'NGN' },
  });
  const branchId = branch.json.id as string;
  const roomType = await api('POST', `/branches/${branchId}/room-types`, { owner, body: { name: 'Standard', baseRate: 20_000, capacity: { adults: 2, children: 1 } } });
  const roomTypeId = roomType.json.id as string;
  await api('POST', `/branches/${branchId}/rooms/bulk`, { owner, body: { roomTypeId, range: { from: 101, to: 100 + rooms } } });
  const list = await api('GET', `/branches/${branchId}/rooms`, { owner });
  const roomIds = (list.json as unknown as Array<{ id: string; number: string }>).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })).map((r) => r.id);
  return { branchId, roomTypeId, roomIds };
}

/** Deletes the organisation the way its owner would. */
export async function deleteOrganisation(owner: Owner | undefined): Promise<void> {
  if (!owner) return;
  // Renewed first: the delete route allows five tries a quarter hour, and a
  // try with an expired sign-in would spend one.
  await renew(owner);
  const res = await api('DELETE', '/tenants/me', { owner, body: { password: owner.password } });
  if (res.status !== 204) throw new Error(`delete ${res.status}: ${JSON.stringify(res.json)}`);
}

/**
 * The one organisation every browser test shares, made by the global setup
 * (one sign-up and one delete a run: both are rate-limited). Each test signs
 * in afresh, so tests never share a session.
 */
export async function sharedOrganisation(): Promise<{ owner: Owner; property: Property }> {
  const email = process.env.E2E_OWNER_EMAIL;
  const password = process.env.E2E_OWNER_PASSWORD;
  if (!email || !password) throw new Error('No shared organisation — run through playwright.config.ts, whose global setup makes it');
  return {
    owner: await signIn(email, password),
    property: { branchId: process.env.E2E_BRANCH_ID ?? '', roomTypeId: process.env.E2E_ROOM_TYPE_ID ?? '', roomIds: (process.env.E2E_ROOM_IDS ?? '').split(',') },
  };
}

/** How long the API's sign-ins last, read from a token. */
export function tokenLifetimeSeconds(token: string): number {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()) as { exp: number; iat: number };
  return payload.exp - payload.iat;
}

/** Signs in through the real sign-in page. */
export async function signInThroughUi(page: Page, owner: Owner): Promise<void> {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.getByLabel('Email').fill(owner.email);
  await page.getByLabel('Password', { exact: true }).fill(owner.password);
  await page.getByRole('button', { name: /sign in|log in/i }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await page.waitForLoadState('networkidle');
}

/** Records the page's sign-in renewals and its other API calls, from the last `reset()`. */
export function watchApi(page: Page) {
  const state = { refreshes: [] as number[], calls: [] as Array<{ path: string; status: number }> };
  page.on('response', (res) => {
    const url = res.url();
    if (!url.startsWith(API_URL)) return;
    const path = url.slice(API_URL.length).split('?')[0];
    if (path === '/auth/refresh') state.refreshes.push(res.status());
    else state.calls.push({ path, status: res.status() });
  });
  return {
    get refreshes() {
      return state.refreshes;
    },
    get calls() {
      return state.calls;
    },
    reset() {
      state.refreshes = [];
      state.calls = [];
    },
    /** Calls that were refused for an expired sign-in and never put right by a later success on the same path. */
    unrecovered(): string[] {
      return state.calls.filter((c, i) => c.status === 401 && !state.calls.slice(i + 1).some((d) => d.path === c.path && d.status < 400)).map((c) => c.path);
    },
  };
}

/** Whether the "your session has ended" prompt is up. */
export async function sessionEndedPromptShown(page: Page): Promise<boolean> {
  return (await page.getByText('Your session has ended').count()) > 0;
}
