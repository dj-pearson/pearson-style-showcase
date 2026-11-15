import { expect, test } from '@playwright/test';
// @ts-expect-error - plain .mjs helper shared with the build scripts, no types
import { readArticles } from '../../scripts/lib/content.mjs';
// @ts-expect-error - plain .mjs helper shared with the build scripts, no types
import { STATIC_ROUTES } from '../../scripts/lib/static-routes.mjs';

/**
 * What a crawler that does not run JavaScript gets from the built site.
 * The preview project serves dist/ with `vite preview` and runs the browser
 * with JavaScript disabled, so everything asserted here is in the HTML the
 * server sent, before React mounts.
 *
 * Run with `npm run test:e2e:preview` (builds first).
 */

interface Article {
  meta: { slug: string; title: string };
}

const ARTICLE_SLUG = 'ai-crm-automation-complete-guide';
const article = (readArticles() as Article[]).find(({ meta }) => meta.slug === ARTICLE_SLUG);
const connect = (STATIC_ROUTES as { path: string; h1: string }[]).find(
  ({ path }) => path === '/connect'
);

test.describe('prerendered HTML without JavaScript', () => {
  test('an article has its title as the h1 and a canonical to itself', async ({ page }) => {
    expect(article, `content/crm/${ARTICLE_SLUG}.md`).toBeDefined();
    const response = await page.goto(`/news/${ARTICLE_SLUG}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toHaveText(article!.meta.title);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      `https://danpearson.net/news/${ARTICLE_SLUG}`
    );
    // The article body is there too, not only the heading.
    expect((await page.locator('#root').innerText()).length).toBeGreaterThan(2000);
  });

  test('/connect has its h1 before JavaScript', async ({ page }) => {
    expect(connect).toBeDefined();
    const response = await page.goto('/connect');
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveText(connect!.h1);
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
      'href',
      'https://danpearson.net/connect'
    );
  });

  test('an unknown URL gets the 404 page, noindexed and without a canonical', async ({ page }) => {
    const response = await page.goto('/this-page-does-not-exist-xyz');
    // The status comes from e2e/preview/vite.preview.config.ts, which mirrors
    // Cloudflare Pages serving dist/404.html; the page content is the build's.
    expect(response?.status()).toBe(404);
    await expect(page.locator('h1')).toHaveText('Page not found');
    await expect(page).toHaveTitle(/^404 - Page Not Found/);
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(0);
  });
});
