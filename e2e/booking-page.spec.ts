import { expect, test } from '@playwright/test';
import { api, sharedOrganisation } from './support';

/**
 * The public booking page's earliest check-in is the property's today — third audit, L27.
 *
 * It took the date in UTC, so for the first hour after midnight in Lagos the
 * page offered yesterday, which the API then refused.
 */
test.describe('Public booking page', () => {
  let slug: string;

  test.beforeAll(async () => {
    const { owner, property } = await sharedOrganisation();
    slug = `browser-${Date.now()}`;
    const published = await api('PUT', `/branches/${property.branchId}/booking-engine`, { owner, body: { slug } });
    expect(published.status).toBe(200);
  });

  test("at half past midnight in Lagos the earliest check-in is Lagos's date, not UTC's", async ({ page }) => {
    // 00:30 in Lagos on 9 October is still 8 October in UTC.
    await page.clock.install({ time: new Date('2026-10-08T23:30:00.000Z') });
    await page.goto(`/book/${slug}`, { waitUntil: 'networkidle' });
    await expect(page.locator('input[type="date"]').first()).toHaveAttribute('min', '2026-10-09');
  });
});
