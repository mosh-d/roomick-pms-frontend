import { expect, test } from '@playwright/test';
import { api, Owner, sharedOrganisation, signIn, signInThroughUi } from './support';

/**
 * No sign-in token in the page's storage: the refresh token sits in an
 * httpOnly cookie no script can read, the access token only in memory. A
 * reload gets the session back from the cookie, and a session saved by the
 * version before (both tokens in localStorage) is traded for the cookie once.
 */
test.describe('Session storage', () => {
  let owner: Owner;

  test.beforeAll(async () => {
    ({ owner } = await sharedOrganisation());
  });

  test('keeps no token where a script could read it, and a reload stays signed in', async ({ page, context }) => {
    await signInThroughUi(page, owner);

    const saved = await page.evaluate(() => ({ local: { ...localStorage }, session: { ...sessionStorage }, cookies: document.cookie }));
    const everything = JSON.stringify(saved);
    expect(everything).not.toMatch(/accessToken|refreshToken|eyJ[\w-]+\.eyJ/);
    expect(saved.cookies).not.toContain('roomick_session');

    const cookie = (await context.cookies()).find((c) => c.name === 'roomick_session');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/api/v1/auth' });

    await page.reload({ waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('button', { name: /log out/i }).first()).toBeVisible();
  });

  test('two tabs loading at the same moment both get the session back — one renewal at a time', async ({ page, context }) => {
    await signInThroughUi(page, owner);
    const second = await context.newPage();
    await second.goto('/dashboard', { waitUntil: 'networkidle' });
    const renewals: number[] = [];
    for (const tab of [page, second]) tab.on('response', (res) => res.url().endsWith('/api/v1/auth/refresh') && renewals.push(res.status()));

    await Promise.all([page.reload({ waitUntil: 'networkidle' }), second.reload({ waitUntil: 'networkidle' })]);
    for (const tab of [page, second]) {
      await expect(tab).toHaveURL(/\/dashboard/);
      await expect(tab.getByRole('button', { name: /log out/i }).first()).toBeVisible();
    }
    // Each tab renewed with the cookie the other left behind: no refusals.
    expect(renewals).toEqual([200, 200]);
  });

  test('signing out ends the session on the server and forgets it here', async ({ page, context }) => {
    await signInThroughUi(page, owner);
    const before = (await context.cookies()).find((c) => c.name === 'roomick_session');
    expect(before).toBeDefined();
    // The sign-out reaches the server once any renewal already on its way has
    // landed (so the cookie it clears is the newest) — wait for its answer.
    const signedOut = page.waitForResponse((res) => new URL(res.url()).pathname === '/api/v1/auth/logout');
    await page.getByRole('button', { name: /log out/i }).first().click();
    await page.waitForURL(/\/login/);
    expect((await signedOut).status()).toBe(204);
    expect((await context.cookies()).find((c) => c.name === 'roomick_session')).toBeUndefined();
    // The session the cookie held is over on the server too.
    const renewed = await api('POST', '/auth/refresh', { cookie: `roomick_session=${before?.value}`, body: {} });
    expect(renewed.status).toBe(401);
  });

  test('trades a session saved by the version before for the cookie, and saves no token again', async ({ page, context }) => {
    // Signed in the old way: both tokens in localStorage.
    const kept = await signIn(owner.email, owner.password);
    const keptToken = kept.sessionCookie.slice('roomick_session='.length);
    const user = { id: kept.userId, tenantId: kept.tenantId, email: kept.email, name: 'Browser Owner', roles: [{ branchId: null, role: 'owner' }] };

    await page.goto('/login');
    await page.evaluate(
      ([token, who]) =>
        localStorage.setItem('roomick-auth', JSON.stringify({ state: { accessToken: 'expired', refreshToken: token, user: who, activeBranchId: null }, version: 0 })),
      [keptToken, user] as const,
    );
    await page.goto('/dashboard', { waitUntil: 'networkidle' });
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('button', { name: /log out/i }).first()).toBeVisible();

    expect((await context.cookies()).find((c) => c.name === 'roomick_session')).toBeDefined();
    const stored = await page.evaluate(() => localStorage.getItem('roomick-auth') ?? '');
    expect(stored).not.toMatch(/accessToken|refreshToken/);
  });
});
