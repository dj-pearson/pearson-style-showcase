import { test, expect } from './fixtures/test-base';

test.describe('Smoke tests', () => {
  test('homepage loads successfully (HTTP 200)', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBe(200);
    // The app root has mounted.
    await expect(page.locator('body')).toBeVisible();
  });

  test('homepage has the correct <title> tag', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Dan Pearson/i);
  });

  test('navigation to /about works', async ({ page }) => {
    const response = await page.goto('/about');
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle(/Dan Pearson/i);
    expect(new URL(page.url()).pathname).toBe('/about');
  });

  test('navigation to /news works', async ({ page }) => {
    const response = await page.goto('/news');
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe('/news');
  });

  test('404 page shows for an invalid route', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-xyz');
    // SPA returns 200 for the shell but renders the NotFound view.
    await expect(page.getByText('404')).toBeVisible();
  });
});
