import { test, expect } from '../fixtures/test-base';

/**
 * The hub lists the CRM articles even when the database has no rows for them.
 * The default fixture returns [] for every table, which is exactly the state of
 * production today (US-074), so this runs against the failure it guards.
 *
 * Asserted by counting article links rather than by title: which titles surface
 * depends on how the hub slices featured and recent, and that is a layout
 * decision this test should not pin down.
 */
test.describe('AI CRM automation topic hub', () => {
  test('lists the built-in articles when the database is empty', async ({ page }) => {
    await page.goto('/topics/ai-crm-automation');
    await page.locator('main, h1').first().waitFor({ timeout: 15000 });

    const articleLinks = page.locator('main a[href^="/news/"]');
    await expect.poll(() => articleLinks.count(), { timeout: 15000 }).toBeGreaterThan(5);
  });

  test('an article linked from the hub opens and renders its body', async ({ page }) => {
    await page.goto('/topics/ai-crm-automation');
    const firstArticle = page.locator('main a[href^="/news/"]').first();
    await firstArticle.waitFor({ timeout: 15000 });
    const href = await firstArticle.getAttribute('href');

    await firstArticle.click();
    await expect(page).toHaveURL(new RegExp(`${href}$`));
    // The body comes from the built-in markdown, since the database has no row.
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page.getByText(/Article Not Found/i)).toHaveCount(0);
  });
});
