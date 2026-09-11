import { test, expect } from '../fixtures/test-base';
import AxeBuilder from '@axe-core/playwright';

/**
 * WCAG 2.1 A/AA regression guard for the public pages (US-023).
 *
 * Each public route must have zero serious/critical axe-core violations.
 * Moderate/minor issues are not gated here but can be reviewed via the full
 * results if this list ever needs tightening.
 */

// /ai-crm-automation is the commercial page, /topics/ai-crm-automation the hub
// that feeds it, and /faq and /ai-tools are linked from the footer on every
// page - none of them were covered, so a violation there would have shipped.
const PUBLIC_PAGES = [
  '/',
  '/about',
  '/news',
  '/projects',
  '/connect',
  '/search',
  '/ai-crm-automation',
  '/topics/ai-crm-automation',
  '/faq',
  '/ai-tools',
  // An article page is the most-read page on the site and was not covered, nor
  // was any of the archive templates a reader lands on from one. The slug is a
  // built-in article, so the page renders from the prerendered markdown without
  // needing a database.
  '/news/agentic-crm-what-actually-works',
  '/news/tag/crm',
  '/news/category/CRM',
  '/author/dan-pearson',
  '/topics',
];

for (const path of PUBLIC_PAGES) {
  test(`no serious/critical accessibility violations on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page
      .locator('main, h1')
      .first()
      .waitFor({ timeout: 15000 })
      .catch(() => {});

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();

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
  // The search palette is an overlay, so it is invisible to a page-level sweep:
  // axe only ever saw the page behind it. It is also the one place on the site a
  // reader drives entirely from the keyboard.
  test('no serious/critical violations in the open search dialog', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Open search' }).first().click();
    await expect(page.getByRole('combobox')).toBeVisible();

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    const seriousOrCritical = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical'
    );

    expect(
      seriousOrCritical,
      seriousOrCritical.map((v) => `${v.impact}:${v.id}`).join(', ')
    ).toEqual([]);
  });

  test('a skip-to-main-content link is present and targets the main region', async ({ page }) => {
    await page.goto('/');
    const skip = page.getByRole('link', { name: /skip to main content/i });
    await expect(skip).toHaveAttribute('href', '#main-content');
    // Becomes visible/actionable on keyboard focus.
    await skip.focus();
    await expect(skip).toBeFocused();
  });
});
