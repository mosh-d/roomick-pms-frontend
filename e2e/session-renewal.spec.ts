import { expect, test } from '@playwright/test';
import { Owner, sessionEndedPromptShown, sharedOrganisation, signInThroughUi, tokenLifetimeSeconds, watchApi } from './support';

/**
 * An expired sign-in is renewed once, however many requests meet it — third audit, L5.
 *
 * Every request that met an expired token renewed it itself. On the Manager
 * Dashboard nine did at once: one renewal succeeded and eight were refused
 * (a renewal token works once), and the session only survived because the
 * winner happened to answer first.
 */
test.describe('Session renewal', () => {
  let owner: Owner;

  test.beforeAll(async () => {
    ({ owner } = await sharedOrganisation());
  });

  test('renews an expired sign-in once — on a page load, on nine requests at once, and on coming back to the tab', async ({ page }) => {
    test.skip(tokenLifetimeSeconds(owner.token) > 10, 'needs the API started with JWT_ACCESS_TTL=5s');
    const watch = watchApi(page);
    await signInThroughUi(page, owner);

    // A full page load after the sign-in has expired.
    await page.waitForTimeout(7_000);
    watch.reset();
    await page.goto('/dashboard/account', { waitUntil: 'networkidle' });
    expect(watch.refreshes).toEqual([200]);
    expect(watch.unrecovered()).toEqual([]);

    // Client-side navigation to the Manager Dashboard: about nine queries meet the expired token together.
    await page.waitForTimeout(7_000);
    watch.reset();
    await page.locator('a[href="/dashboard/manager"]').first().click();
    await page.waitForURL(/\/dashboard\/manager/);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1_500);
    expect(watch.refreshes).toEqual([200]);
    expect(watch.calls.filter((c) => c.status === 401).length).toBeGreaterThan(1);
    expect(watch.unrecovered()).toEqual([]);
    expect(await sessionEndedPromptShown(page)).toBe(false);

    // Coming back to the tab: every mounted query refetches.
    await page.waitForTimeout(7_000);
    watch.reset();
    await page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
      window.dispatchEvent(new Event('focus'));
    });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2_000);
    expect(watch.refreshes.length).toBeLessThanOrEqual(1);
    expect(watch.unrecovered()).toEqual([]);
    expect(await sessionEndedPromptShown(page)).toBe(false);
  });
});
