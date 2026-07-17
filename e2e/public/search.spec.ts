import { test, expect } from '../fixtures/test-base';

/**
 * E2E coverage for global search (/search):
 *   - empty state before typing
 *   - typing a query (>= 2 chars, 300ms debounce) shows mocked results
 *   - clicking an article result navigates to the article detail page
 *   - a query with no matches shows the empty-results state
 *
 * The search page queries the articles, projects and ai_tools tables. The
 * default fixture returns `[]` for every /rest/v1 table; here we override just
 * the articles table to return a matching row.
 */

const ARTICLE_RESULT = {
  id: 'search-article-1',
  slug: 'react-performance-guide',
  title: 'React Performance Optimization Guide',
  excerpt: 'Practical techniques to speed up your React apps.',
  category: 'Engineering',
  tags: ['React', 'Performance'],
  image_url: null,
};

test.describe('Global search', () => {
  test('shows the empty prompt before a query is entered', async ({ page }) => {
    await page.goto('/search');
    await expect(page.getByRole('heading', { name: 'Search' })).toBeVisible();
    await expect(page.getByText(/Enter a search query to get started/i)).toBeVisible();
  });

  test('typing a query shows matching results', async ({ page }) => {
    // Return a matching article; other tables stay empty (default mock).
    await page.route('**/rest/v1/articles*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([ARTICLE_RESULT]),
      })
    );

    await page.goto('/search');
    await page.getByLabel(/Search for articles, projects, AI tools/i).fill('React');

    await expect(page.getByRole('heading', { name: ARTICLE_RESULT.title })).toBeVisible();
    await expect(page.getByText(/Found 1 result for "React"/i)).toBeVisible();
  });

  test('clicking an article result navigates to the article', async ({ page }) => {
    await page.route('**/rest/v1/articles*', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([ARTICLE_RESULT]),
      })
    );

    await page.goto('/search');
    await page.getByLabel(/Search for articles, projects, AI tools/i).fill('React');

    await page.getByRole('heading', { name: ARTICLE_RESULT.title }).click();
    await expect(page).toHaveURL(new RegExp(`/news/${ARTICLE_RESULT.slug}$`));
  });

  test('a query with no matches shows the no-results state', async ({ page }) => {
    // All tables return empty (default fixture mock) -> no results.
    await page.goto('/search');
    await page.getByLabel(/Search for articles, projects, AI tools/i).fill('zxqwv');

    await expect(page.getByText(/No results found for "zxqwv"/i)).toBeVisible();
  });
});
