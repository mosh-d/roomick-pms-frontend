import { expect, test } from '@playwright/test';
import { Owner, sharedOrganisation, signInThroughUi, tokenLifetimeSeconds, watchApi } from './support';

/**
 * A download after the sign-in has expired renews it and downloads — third audit, M12.
 *
 * Downloads made a bare request with the stored token and gave up on any
 * refusal: after a quiet quarter of an hour, the first Download PDF (the
 * registration card at check-in, a report, a BEO) said "Could not download
 * the file".
 */
test.describe('Downloads', () => {
  let owner: Owner;

  test.beforeAll(async () => {
    ({ owner } = await sharedOrganisation());
  });

  test('"Export PDF" after the sign-in expired renews it and downloads the file', async ({ page }) => {
    test.skip(tokenLifetimeSeconds(owner.token) > 10, 'needs the API started with JWT_ACCESS_TTL=5s');
    const watch = watchApi(page);
    await signInThroughUi(page, owner);
    await page.goto('/dashboard/reports/operational', { waitUntil: 'networkidle' });

    await page.waitForTimeout(7_000);
    watch.reset();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /Export PDF/ }).click();
    expect((await download).suggestedFilename()).toMatch(/\.pdf$/);

    expect(watch.refreshes).toEqual([200]);
    expect(watch.calls.filter((c) => c.path.endsWith('/pdf')).map((c) => c.status)).toEqual([401, 200]);
    await expect(page.getByText(/Could not (download|export)/i)).toHaveCount(0);
  });
});
