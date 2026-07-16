import { test, expect } from '../fixtures/test-base';
import AxeBuilder from '@axe-core/playwright';

/**
 * WCAG 2.1 A/AA regression guard for the public pages (US-023).
 *
 * Each public route must have zero serious/critical axe-core violations.
 * Moderate/minor issues are not gated here but can be reviewed via the full
 * results if this list ever needs tightening.
 */

const PUBLIC_PAGES = ['/', '/about', '/news', '/projects', '/connect', '/search'];

for (const path of PUBLIC_PAGES) {
  test(`no serious/critical accessibility violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.locator('main, h1').first().waitFor({ timeout: 15000 }).catch(() => {});

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();

    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );

    expect(
      seriousOrCritical,
      seriousOrCritical.map((v) => `${v.impact}:${v.id}`).join(', ')
    ).toEqual([]);
  });
}

test.describe('Accessibility affordances', () => {
  test('a skip-to-main-content link is present and targets the main region', async ({ page }) => {
    await page.goto('/');
    const skip = page.getByRole('link', { name: /skip to main content/i });
    await expect(skip).toHaveAttribute('href', '#main-content');
    // Becomes visible/actionable on keyboard focus.
    await skip.focus();
    await expect(skip).toBeFocused();
  });
});
