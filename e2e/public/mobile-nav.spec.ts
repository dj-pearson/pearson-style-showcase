import { test, expect } from '../fixtures/test-base';

/**
 * US-045: the mobile menu animates open via a GSAP timeline; verify items
 * settle visible (a broken timeline would leave them at opacity 0).
 */
test.describe('Mobile navigation', () => {
  test.use({ viewport: { width: 375, height: 720 } });

  test('menu opens and nav items are visible', async ({ page }) => {
    await page.goto('/');
    await page.locator('h1').first().waitFor();

    await page
      .getByRole('button', { name: /toggle menu|menu|open menu/i })
      .first()
      .click();

    const menu = page.locator('#mobile-navigation-menu');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('link', { name: 'About Me' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Projects' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Connect' })).toBeVisible();
  });
});
