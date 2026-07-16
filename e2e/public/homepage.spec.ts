import { test, expect } from '../fixtures/test-base';
import AxeBuilder from '@axe-core/playwright';

test.describe('Homepage', () => {
  test('hero section renders (3D orb or fallback)', async ({ page }) => {
    await page.goto('/');
    // The hero region mounts near the top of the page; assert the primary
    // heading / hero area is visible (the 3D orb lazy-loads or falls back).
    await expect(page.locator('h1').first()).toBeVisible();
  });

  test('featured content section loads', async ({ page }) => {
    await page.goto('/');
    // The homepage renders its highlighted services/featured content statically.
    await expect(page.getByText(/Sales Leadership/i)).toBeVisible();
  });

  test('navigation menu has all expected links', async ({ page }) => {
    await page.goto('/');
    const nav = page.locator('nav').first();
    await expect(nav).toBeVisible();
    for (const path of ['/about', '/projects', '/news', '/ai-tools', '/connect']) {
      await expect(nav.locator(`a[href="${path}"]`).first()).toHaveCount(1);
    }
  });

  test('footer renders with links', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await expect(footer).toBeVisible();
    // Footer contains at least one internal navigation link.
    expect(await footer.locator('a').count()).toBeGreaterThan(0);
  });

  test('passes basic accessibility checks (no serious/critical axe violations)', async ({ page }) => {
    await page.goto('/');
    await page.locator('h1').first().waitFor();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);
  });
});
