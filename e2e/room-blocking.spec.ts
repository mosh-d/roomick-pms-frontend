import { expect, test } from '@playwright/test';
import { api, lagosDay, Owner, Property, sharedOrganisation, signInThroughUi } from './support';

/**
 * Cancelling a room block that hasn't started — third audit, H2, in the page.
 *
 * "End Block" on a future block crashed with "Something went wrong", and
 * nothing else could remove a block entered by mistake. A block that hasn't
 * started now says "Cancel Block", and cancelling removes it.
 */
test.describe('Room blocking', () => {
  let owner: Owner;
  let property: Property;

  test.beforeAll(async () => {
    ({ owner, property } = await sharedOrganisation());
  });

  test('offers "Cancel Block" on a block that has not started, and cancelling removes it', async ({ page }) => {
    const block = await api('POST', `/rooms/${property.roomIds[1]}/block`, { owner, body: { reason: 'renovation', fromDate: lagosDay(5), toDate: lagosDay(7) } });
    expect(block.status).toBe(201);

    await signInThroughUi(page, owner);
    await page.goto('/dashboard/housekeeping/room-blocking', { waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: 'End Block' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Cancel Block' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel Block' }).click();
    await expect(page.getByText('No rooms are currently blocked.')).toBeVisible();
    await expect(page.getByText(/went wrong/i)).toHaveCount(0);

    const listed = await api('GET', `/branches/${property.branchId}/room-blocks`, { owner });
    expect(listed.json).toEqual([]);
  });
});
