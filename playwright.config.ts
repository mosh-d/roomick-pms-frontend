import { defineConfig, devices } from '@playwright/test';

/**
 * Browser tests: the production build in a real browser against a real API.
 *
 * They need both running first — the API with 5-second sign-ins
 * (`JWT_ACCESS_TTL=5s`), so a session can expire mid-test, and the web app
 * built against that API. CI starts both (see .github/workflows/ci.yml);
 * locally, point `E2E_API_URL` and `E2E_WEB_URL` at yours.
 */
export default defineConfig({
  testDir: './e2e',
  // One organisation for the whole run: sign-ups and deletes are rate-limited.
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',
  // One browser at a time: the tests wait out real sign-in expiries.
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_WEB_URL ?? 'http://localhost:3097',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
