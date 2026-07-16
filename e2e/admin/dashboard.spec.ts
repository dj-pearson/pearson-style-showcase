import { test, expect } from '../fixtures/test-base';
import { seedAdminSession, mockAdminAuth } from '../fixtures/admin-session';

/**
 * E2E coverage for the admin dashboard: navigation rendering, tab switching,
 * and logout. All tests run as an authenticated admin (seeded session +
 * stubbed admin-auth verification).
 */

test.describe('Admin dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await seedAdminSession(page);
    await mockAdminAuth(page);
  });

  test('renders the admin dashboard with navigation items', async ({ page }) => {
    await page.goto('/admin/dashboard');

    // Header confirms we landed on the dashboard (not redirected to login).
    await expect(page.getByRole('heading', { name: 'Admin', exact: true })).toBeVisible();

    // The sidebar navigation exposes the main sections as buttons. The sidebar
    // renders collapsed (icon-only) by default, but the labelled buttons are
    // present in the accessibility tree.
    for (const label of ['Articles', 'Projects', 'Accounting']) {
      await expect(page.getByRole('button', { name: label, exact: true })).toHaveCount(1);
    }
  });

  test('switching navigation loads the corresponding content panel', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page.getByRole('heading', { name: 'Admin', exact: true })).toBeVisible();

    // Switch to the Articles section and confirm its manager panel loads.
    await page.getByRole('button', { name: 'Articles', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Article/i }).first()).toBeVisible();

    // Switch to the Projects section and confirm its panel loads.
    await page.getByRole('button', { name: 'Projects', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Project/i }).first()).toBeVisible();
  });

  test('logout ends the session and redirects to login', async ({ page }) => {
    await page.goto('/admin/dashboard');
    await expect(page.getByRole('heading', { name: 'Admin', exact: true })).toBeVisible();

    await page.getByRole('button', { name: /Logout/i }).click();

    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole('heading', { name: /Admin Access/i })).toBeVisible();
  });
});
