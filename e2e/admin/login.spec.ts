import { test, expect } from '../fixtures/test-base';
import { seedAdminSession, mockAdminAuth } from '../fixtures/admin-session';

/**
 * E2E coverage for the admin login page and protected-route access control.
 *
 * The real login flow routes a successful password sign-in through an MFA
 * enrollment/verification step before admin verification, so "valid credentials
 * land on the dashboard" is exercised via an already-authenticated admin
 * session (the login page redirects verified admins to the dashboard).
 */

test.describe('Admin login', () => {
  test('renders email and password fields', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: /Admin Access/i })).toBeVisible();
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
  });

  test('invalid credentials show an error message', async ({ page }) => {
    // gotrue returns 400 with an error description for bad credentials; the
    // login page surfaces that message in a destructive alert.
    await page.route('**/auth/v1/token**', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'invalid_grant',
          error_description: 'Invalid login credentials',
        }),
      })
    );

    await page.goto('/admin/login');
    await page.getByLabel('Email', { exact: true }).fill('wrong@example.com');
    await page.getByLabel('Password', { exact: true }).fill('badpassword');
    await page.getByRole('button', { name: /Sign In/i }).click();

    await expect(page.getByText(/Invalid login credentials/i)).toBeVisible();
    // Still on the login page.
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test('an authenticated admin is redirected from login to the dashboard', async ({ page }) => {
    await seedAdminSession(page);
    await mockAdminAuth(page);

    await page.goto('/admin/login');

    await expect(page).toHaveURL(/\/admin\/dashboard$/);
  });

  test('unauthenticated access to /admin/dashboard redirects to login', async ({ page }) => {
    // No seeded session -> ProtectedRoute redirects to the login page.
    await page.goto('/admin/dashboard');
    await expect(page).toHaveURL(/\/admin\/login$/);
    await expect(page.getByRole('heading', { name: /Admin Access/i })).toBeVisible();
  });
});
