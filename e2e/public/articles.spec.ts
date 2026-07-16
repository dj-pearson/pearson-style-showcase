import { test, expect } from '../fixtures/test-base';

/**
 * E2E coverage for the article reading flow:
 *   /news (list) -> click a card -> /news/:slug (detail).
 *
 * The News list issues two requests to /rest/v1/articles: a HEAD request for
 * the exact count and a GET for the page of rows. The Article detail page uses
 * `.maybeSingle()`, which sets `Accept: application/vnd.pgrst.object+json`, so
 * we can distinguish the single-row fetch from the list fetch by that header.
 */

const ARTICLE = {
  id: 'article-1',
  slug: 'ai-automation-for-small-business',
  title: 'AI Automation for Small Business',
  excerpt: 'How small businesses can adopt AI automation to cut costs.',
  content:
    '# AI Automation for Small Business\n\nThis is the article body used in E2E tests. It explains **practical** steps to adopt automation.\n\n## Key point\n\nStart small and measure results.',
  category: 'AI Automation',
  tags: ['AI', 'Automation', 'Business'],
  image_url: null,
  created_at: '2026-01-05T12:00:00.000Z',
  updated_at: '2026-01-05T12:00:00.000Z',
  read_time: '5 min read',
  view_count: 123,
  featured: true,
  published: true,
  author: 'Dan Pearson',
};

test.describe('Article reading flow', () => {
  test.beforeEach(async ({ page }) => {
    // Override the default empty-array REST mock for the articles table.
    await page.route('**/rest/v1/articles*', (route) => {
      const request = route.request();
      const method = request.method();
      const accept = request.headers()['accept'] || '';

      // Count query (HEAD, `count: exact`, `head: true`).
      if (method === 'HEAD') {
        return route.fulfill({
          status: 200,
          headers: { 'content-range': '0-0/1' },
          contentType: 'application/json',
          body: '',
        });
      }

      // Single-row fetch via `.maybeSingle()` on the detail page.
      if (accept.includes('application/vnd.pgrst.object+json')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(ARTICLE),
        });
      }

      // List fetch on the News page.
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([ARTICLE]),
      });
    });
  });

  test('news page lists published articles', async ({ page }) => {
    await page.goto('/news');
    await expect(page.getByRole('heading', { name: ARTICLE.title })).toBeVisible();
    await expect(page.getByText(ARTICLE.excerpt)).toBeVisible();
  });

  test('clicking an article navigates to its detail page', async ({ page }) => {
    await page.goto('/news');

    // The card title links to /news/:slug.
    await page.getByRole('link', { name: ARTICLE.title }).first().click();

    await expect(page).toHaveURL(new RegExp(`/news/${ARTICLE.slug}$`));
    // The heading renders on the detail page (markdown H1 or article title).
    await expect(page.getByRole('heading', { name: ARTICLE.title }).first()).toBeVisible();
  });

  test('article detail renders markdown body content', async ({ page }) => {
    await page.goto(`/news/${ARTICLE.slug}`);
    // A distinctive line from the markdown body should be rendered.
    await expect(page.getByText(/Start small and measure results/i)).toBeVisible();
  });

  test('article detail sets an article-specific document title', async ({ page }) => {
    await page.goto(`/news/${ARTICLE.slug}`);
    // SEO component sets the <title>; wait for it to include the article title.
    await expect(page).toHaveTitle(new RegExp(ARTICLE.title, 'i'));
  });

  test('back-to-news navigation works from an article', async ({ page }) => {
    await page.goto(`/news/${ARTICLE.slug}`);
    // The detail page provides a link back to the news listing. The link's
    // accessible name comes from its aria-label ("Return to all articles").
    await page.getByRole('link', { name: /all articles/i }).first().click();
    await expect(page).toHaveURL(/\/news$/);
  });
});
