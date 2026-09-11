import { test, expect } from '../fixtures/test-base';

/**
 * The contents panel is built from the markdown source and the headings are
 * rendered by react-markdown, so the two derive their ids independently. If
 * they ever disagree every entry becomes a dead anchor, and nothing in a unit
 * test would notice - both sides would agree with themselves.
 */
test('every contents link points at a heading that exists on the page', async ({ page }) => {
  await page.goto('/news/agentic-crm-what-actually-works');

  const nav = page.getByRole('navigation', { name: 'Article contents' });
  await expect(nav).toBeVisible();

  const hrefs = await nav
    .getByRole('link')
    .evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).getAttribute('href')!));

  expect(hrefs.length).toBeGreaterThan(3);
  for (const href of hrefs) {
    await expect(page.locator(href)).toHaveCount(1);
  }
});
