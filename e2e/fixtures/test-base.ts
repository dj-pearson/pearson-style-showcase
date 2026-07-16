import { test as base, expect, type Page } from '@playwright/test';

/**
 * Shared E2E test fixtures.
 *
 * The dev server itself is started/stopped by the `webServer` block in
 * playwright.config.ts (not here). These fixtures layer on:
 *
 * - `mockSupabase`: an auto-fixture that intercepts Supabase REST/Auth/Storage
 *   and edge-function calls so tests never hit real backends. It returns benign
 *   empty payloads by default; individual tests can add their own page.route
 *   overrides afterwards.
 * - `loginAsAdmin`: a helper that seeds a fake authenticated admin session in
 *   localStorage so protected admin routes can be exercised without a real login.
 */

type Fixtures = {
  mockSupabase: void;
  loginAsAdmin: (page: Page) => Promise<void>;
};

export const test = base.extend<Fixtures>({
  // Auto-apply Supabase mocking to every test that uses this `test`.
  mockSupabase: [
    async ({ page }, use) => {
      // Supabase Auth: report no active session.
      await page.route('**/auth/v1/**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ session: null, user: null, data: null, error: null }),
        })
      );
      // Supabase REST: empty result sets.
      await page.route('**/rest/v1/**', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      );
      // Edge functions: generic success.
      await page.route('**/functions/v1/**', (route) =>
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        })
      );
      await use();
    },
    { auto: true },
  ],

  loginAsAdmin: async ({ page: _page }, use) => {
    const helper = async (page: Page) => {
      // Seed a fake Supabase session + cached admin so the AuthContext treats
      // the browser as an authenticated admin without a real network login.
      await page.addInitScript(() => {
        const fakeSession = {
          access_token: 'e2e-fake-token',
          refresh_token: 'e2e-fake-refresh',
          expires_at: Math.floor(Date.now() / 1000) + 3600,
          token_type: 'bearer',
          user: { id: 'e2e-admin', email: 'admin@danpearson.net' },
        };
        try {
          localStorage.setItem(
            'sb-localhost-auth-token',
            JSON.stringify({ currentSession: fakeSession, expiresAt: fakeSession.expires_at })
          );
        } catch {
          /* ignore */
        }
      });
    };
    await use(helper);
  },
});

export { expect };
