import { expect, test, type Page } from '@playwright/test';
import { api, lagosDay, Owner, Property, sharedOrganisation, signInThroughUi } from './support';

/**
 * The standard hotel features added together — packages, day use, channel
 * allotments, turndown, room release dates, POS discounts and split payments,
 * points expiry — each driven through its own page, and what the page did
 * checked on the API.
 *
 * One page, signed in once, for the whole run: sign-ins are limited to ten a
 * minute from one address, and a test each signing in afresh ran past that
 * on CI's faster machines.
 */
test.describe.serial('Standard features', () => {
  let owner: Owner;
  let property: Property;
  let packageId: string;
  let stayId: string;
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    ({ owner, property } = await sharedOrganisation());
    page = await browser.newPage();
    await signInThroughUi(page, owner);
  });

  /** Picks `option` in the combobox labelled `label`. */
  async function choose(page: Page, label: string | RegExp, option: string | RegExp): Promise<void> {
    await page.getByRole('combobox', { name: label }).click();
    await page.getByRole('option', { name: option }).click();
  }

  async function noErrors(page: Page): Promise<void> {
    await expect(page.getByText(/went wrong/i)).toHaveCount(0);
  }

  test('a manager adds a package on the Rate Resolver page', async () => {
    await page.goto('/dashboard/reservations/rate-plans', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Add Package' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Name').fill('Breakfast');
    await dialog.getByRole('spinbutton', { name: /^Price/ }).fill('5000');
    await choose(page, 'Priced', 'Priced a guest, a night');
    await dialog.getByRole('button', { name: 'Add Package' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('cell', { name: 'Breakfast' })).toBeVisible();
    await noErrors(page);

    const packages = await api('GET', `/branches/${property.branchId}/packages`, { owner });
    const list = packages.json as unknown as Array<{ id: string; name: string; basis: string; price: string }>;
    expect(list).toEqual([expect.objectContaining({ name: 'Breakfast', basis: 'per_person_per_night', price: '5000.00' })]);
    packageId = list[0].id;
  });

  test('the desk books a stay with the package, priced in the preview', async () => {
    await page.goto('/dashboard/reservations/create', { waitUntil: 'networkidle' });
    await page.getByLabel('Name').fill('Package Guest');
    await page.getByLabel('Email').fill(`package.${Date.now()}@example.com`);
    await choose(page, 'Room Type', 'Standard');
    await page.getByLabel('Check-In Date').fill(lagosDay(60));
    await page.getByLabel('Check-Out Date').fill(lagosDay(61));
    await page.getByLabel('Adults').fill('2');
    await page.getByRole('button', { name: 'Packages (optional)' }).click();
    await page.getByRole('option', { name: /Breakfast/ }).click();
    // One night at 20,000, breakfast for two at 5,000 each.
    await expect(page.getByText('Total with packages')).toBeVisible();
    await expect(page.getByText('₦30,000.00')).toBeVisible();
    await page.getByRole('button', { name: 'Book Reservation' }).click();
    await page.waitForURL(/\/dashboard\/arrivals/);

    const found = await api('GET', `/branches/${property.branchId}/reservations?search=Package%20Guest`, { owner });
    const stay = (found.json as unknown as Array<{ packages: Array<{ packageId: string }> | null; confirmedRate: string }>)[0];
    expect(stay.packages).toEqual([expect.objectContaining({ packageId })]);
  });

  test('day use: with the branch selling it, the desk books a room for the day', async () => {
    expect((await api('PATCH', `/branches/${property.branchId}/policies/day-use`, { owner, body: { enabled: true, from: '10:00', until: '17:00' } })).status).toBe(200);
    expect((await api('PATCH', `/room-types/${property.roomTypeId}`, { owner, body: { dayUseRate: 8000 } })).status).toBe(200);
    try {
      await page.goto('/dashboard/reservations/create', { waitUntil: 'networkidle' });
      await page.getByLabel('Name').fill('Day Guest');
      await page.getByLabel('Email').fill(`day.${Date.now()}@example.com`);
      await choose(page, 'Room Type', 'Standard');
      await page.getByRole('radiogroup', { name: 'Day use — 10:00 to 17:00, no night' }).getByText('Yes').click();
      await expect(page.getByLabel('Check-Out Date')).toHaveCount(0);
      await page.getByLabel('Date', { exact: true }).fill(lagosDay(62));
      await expect(page.getByText('The room for the day, 10:00 to 17:00')).toBeVisible();
      await expect(page.getByText('₦8,000.00')).toBeVisible();
      await page.getByRole('button', { name: 'Book Reservation' }).click();
      await page.waitForURL(/\/dashboard\/arrivals/);

      const found = await api('GET', `/branches/${property.branchId}/reservations?search=Day%20Guest`, { owner });
      const stay = (found.json as unknown as Array<{ isDayUse: boolean; checkInDate: string; checkOutDate: string }>)[0];
      expect(stay).toMatchObject({ isDayUse: true });
      expect(stay.checkOutDate.slice(0, 10)).toBe(stay.checkInDate.slice(0, 10));
    } finally {
      await api('PATCH', `/branches/${property.branchId}/policies/day-use`, { owner, body: { enabled: false } });
      await api('PATCH', `/room-types/${property.roomTypeId}`, { owner, body: { dayUseRate: null } });
    }
  });

  test('a channel allotment is added, changed and removed on Revenue Management', async () => {
    await page.goto('/dashboard/revenue', { waitUntil: 'networkidle' });
    // The page has a Room Type field in each of its sections.
    await page.locator('#allotment-room-type').click();
    await page.getByRole('option', { name: 'Standard' }).click();
    await page.locator('#allotment-rooms').fill('1');
    await page.getByLabel('First Night').fill(lagosDay(70));
    await page.getByLabel('Last Night').fill(lagosDay(72));
    await page.getByRole('button', { name: 'Add Allotment' }).click();
    const row = page.getByRole('row', { name: /Website/ });
    await expect(row).toContainText('Standard');
    await row.getByRole('button', { name: 'Change' }).click();
    await row.getByRole('spinbutton').fill('2');
    await row.getByRole('button', { name: 'Save' }).click();
    await expect(row.getByRole('cell', { name: '2', exact: true })).toBeVisible();
    const listed = (await api('GET', `/branches/${property.branchId}/channel-allotments`, { owner })).json as unknown as Array<{ channel: string; rooms: number }>;
    expect(listed).toEqual([expect.objectContaining({ channel: 'website', rooms: 2 })]);

    await row.getByRole('button', { name: 'Remove' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Remove' }).click();
    await expect(page.getByText('No allotments — every channel sells from the whole house.')).toBeVisible();
    await noErrors(page);
  });

  test('turndown: switched on in Property Config, done from the Task Board', async () => {
    await page.goto('/dashboard/property-config', { waitUntil: 'networkidle' });
    await page.getByRole('radiogroup', { name: 'Turn rooms down in the evening' }).getByText('Yes').click();
    await page.getByRole('button', { name: 'Save Turndown' }).click();
    await expect.poll(async () => ((await api('GET', `/branches/${property.branchId}`, { owner })).json as { turndownPolicy: unknown }).turndownPolicy).toEqual({ scope: 'all' });

    // A guest arrives: tonight's turndown is on the board.
    const booked = await api('POST', `/branches/${property.branchId}/reservations`, {
      owner,
      body: { guest: { name: 'Turndown Guest', email: `turndown.${Date.now()}@example.com` }, roomTypeId: property.roomTypeId, checkInDate: lagosDay(0), checkOutDate: lagosDay(2), adults: 2 },
    });
    expect(booked.status).toBe(201);
    stayId = booked.json.id as string;
    expect((await api('POST', `/reservations/${stayId}/check-in`, { owner, body: { roomId: property.roomIds[1] } })).status).toBe(201);

    await page.goto('/dashboard/housekeeping/task-board', { waitUntil: 'networkidle' });
    await expect(page.getByRole('heading', { name: 'Evening Turndowns' })).toBeVisible();
    await page.getByRole('button', { name: 'Start Turndown' }).first().click();
    await expect(page.getByText('Turning down')).toBeVisible();
    await page.getByRole('button', { name: 'Complete' }).first().click();
    await expect(page.getByText('Turning down')).toHaveCount(0);
    await noErrors(page);
  });

  test('a package added to the stay under way from the In-House list is charged from tonight', async () => {
    await page.goto('/dashboard/in-house-guest-list', { waitUntil: 'networkidle' });
    await page.getByRole('row', { name: /Turndown Guest/ }).getByRole('button', { name: 'Packages' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Packages on this stay' }).click();
    await dialog.getByRole('option', { name: /Breakfast/ }).click();
    await dialog.getByRole('button', { name: 'Save Packages' }).click();
    await expect(dialog.getByText('Packages saved.')).toBeVisible();

    const folios = (await api('GET', `/reservations/${stayId}/folios`, { owner })).json as unknown as Array<{ id: string }>;
    const bill = (await api('GET', `/folios/${folios[0].id}`, { owner })).json as { lineItems: Array<{ packageId: string | null; amount: string; serviceDate: string }> };
    expect(bill.lineItems.filter((line) => line.packageId === packageId).map((line) => [line.amount, line.serviceDate.slice(0, 10)])).toEqual([['10000', lagosDay(0)]]);
  });

  test('a room is put out of order until a date, then released, on the Room Status Board', async () => {
    await page.goto('/dashboard/room-status-board', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: '101', exact: true }).click();
    await page.getByLabel('Back in service on (optional)').fill(lagosDay(3));
    await page.getByRole('button', { name: 'Out of Order' }).click();
    await expect(page.getByText(/^Back in service on /)).toBeVisible();
    const held = ((await api('GET', `/branches/${property.branchId}/rooms`, { owner })).json as unknown as Array<{ id: string; heldStatus: string | null; heldUntil: string | null }>).find((room) => room.id === property.roomIds[0]);
    expect(held).toMatchObject({ heldStatus: 'out_of_order' });
    expect(held?.heldUntil?.slice(0, 10)).toBe(lagosDay(3));

    await page.getByRole('button', { name: 'Release Hold' }).click();
    await expect(page.getByRole('button', { name: 'Out of Order' })).toBeVisible();
    const released = ((await api('GET', `/branches/${property.branchId}/rooms`, { owner })).json as unknown as Array<{ id: string; heldStatus: string | null; heldUntil: string | null }>).find((room) => room.id === property.roomIds[0]);
    expect(released).toMatchObject({ heldStatus: null, heldUntil: null });
    await noErrors(page);
  });

  test('POS: a manager’s discount, and a sale split between cash and card', async () => {
    const outlet = await api('POST', `/branches/${property.branchId}/pos/outlets`, { owner, body: { name: 'Pool Bar', category: 'bar' } });
    expect(outlet.status).toBe(201);
    expect((await api('POST', `/pos/outlets/${outlet.json.id as string}/menu-items`, { owner, body: { name: 'Chapman', category: 'Drinks', price: 2000 } })).status).toBe(201);
    const shift = await api('POST', `/branches/${property.branchId}/shifts/open`, { owner, body: { shiftType: 'morning', openingFloat: 0 } });
    expect(shift.status).toBe(201);
    try {
      await page.goto('/dashboard/pos/terminal', { waitUntil: 'networkidle' });
      // The menu's own tile — the basket adds its own Chapman buttons once there's one in it.
      const chapman = page.getByRole('tabpanel').getByRole('button', { name: /Chapman/ });
      await chapman.click();
      await chapman.click();
      await page.getByRole('button', { name: 'Add a discount' }).click();
      await page.getByLabel('Percent').fill('10');
      await page.getByLabel('Reason').fill('Regular guest');
      await expect(page.getByText('−₦400.00')).toBeVisible();
      await page.getByRole('button', { name: 'Split cash + card' }).click();
      await page.getByLabel('Paid in cash').fill('1000');
      await page.getByRole('button', { name: 'Take ₦1,000.00 cash + ₦2,600.00 card' }).click();
      await expect(page.getByText('Order #1 — ₦3,600.00')).toBeVisible();
      await expect(page.getByText('₦1,000.00 cash + ₦2,600.00 card').first()).toBeVisible();
      await expect(page.getByText(/₦400\.00 off \(Regular guest\)/)).toBeVisible();
      await noErrors(page);
    } finally {
      await api('POST', `/shifts/${shift.json.id as string}/close`, { owner, body: { closingCashCounted: 1000 } });
    }
  });

  test('loyalty: points are set to lapse after so many months', async () => {
    await page.goto('/dashboard/loyalty', { waitUntil: 'networkidle' });
    await page.getByLabel('Points lapse after (months)').fill('24');
    await page.getByRole('button', { name: 'Save Programme' }).click();
    await expect.poll(async () => ((await api('GET', '/loyalty/program', { owner })).json as { pointsExpireAfterMonths: number | null }).pointsExpireAfterMonths).toBe(24);
    await noErrors(page);
  });

  test('a guest adds the package on the booking page and sees it in the price', async () => {
    const slug = `browser-features-${Date.now()}`;
    expect((await api('PUT', `/branches/${property.branchId}/booking-engine`, { owner, body: { slug } })).status).toBe(200);
    await page.goto(`/book/${slug}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Select' }).first().click();
    await page.getByRole('checkbox', { name: /Breakfast/ }).check();
    // Two nights at 20,000, breakfast for two guests at 5,000 a night each.
    await expect(page.getByText('NGN 60000.00')).toBeVisible();
    await noErrors(page);
  });

  test.afterAll(async () => {
    await page?.close();
    if (stayId) await api('POST', `/reservations/${stayId}/check-out`, { owner, body: {} });
    await api('PATCH', `/branches/${property.branchId}/policies/turndown`, { owner, body: { enabled: false } });
  });
});
