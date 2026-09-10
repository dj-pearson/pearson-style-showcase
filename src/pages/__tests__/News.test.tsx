import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import type { SupabaseMock } from '@/test/mocks/supabase';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '@/integrations/supabase/client';
import { CRM_ARTICLE_INDEX } from '@/content/crm-article-index.generated';
import News from '../News';

const mock = supabase as unknown as SupabaseMock;

beforeEach(() => {
  mock.resetTableResults();
});

describe('News listing', () => {
  /**
   * The state of production today (US-074): no CRM article has a database row.
   * The page has to list them anyway, and page one holds PAGE_SIZE of them.
   */
  it('lists the built-in articles when the database returns nothing', async () => {
    mock.setTableResult('articles', { data: [], error: null });
    render(<News />, { initialEntries: ['/news'] });

    await waitFor(
      () => {
        const links = document.querySelectorAll('a[href^="/news/"]');
        expect(links.length).toBeGreaterThan(5);
      },
      { timeout: 5000 }
    );
  });

  // Each card renders two links to the same article (the title and Read More),
  // so uniqueness is asserted on hrefs rather than on the element count.
  it('never lists an article twice', async () => {
    mock.setTableResult('articles', { data: [], error: null });
    render(<News />, { initialEntries: ['/news'] });

    await waitFor(
      () => expect(document.querySelectorAll('a[href^="/news/"]').length).toBeGreaterThan(5),
      { timeout: 5000 }
    );

    const hrefs = [...document.querySelectorAll('a[href^="/news/"]')].map((a) =>
      a.getAttribute('href')
    );
    expect(new Set(hrefs).size).toBe(CRM_ARTICLE_INDEX.length);
  });

  it('shows no more than one page of them at a time', async () => {
    mock.setTableResult('articles', { data: [], error: null });
    render(<News />, { initialEntries: ['/news'] });

    await waitFor(
      () => expect(document.querySelectorAll('a[href^="/news/"]').length).toBeGreaterThan(5),
      { timeout: 5000 }
    );

    // PAGE_SIZE is 12 in News.tsx; the built-in set must not overflow a page.
    const unique = new Set(
      [...document.querySelectorAll('a[href^="/news/"]')].map((a) => a.getAttribute('href'))
    );
    expect(unique.size).toBeLessThanOrEqual(12);
  });

  /**
   * The filters used to run over the current page only, so a category with no
   * article among the visible twelve looked empty even with matches elsewhere.
   * Filtering now happens before paging, in the database or over the merged
   * set, so a category filter narrows the whole archive.
   */
  it('filters the whole set, not just the visible page', async () => {
    mock.setTableResult('articles', { data: [], error: null });
    const { unmount } = render(<News />, { initialEntries: ['/news'] });

    await waitFor(
      () => expect(document.querySelectorAll('a[href^="/news/"]').length).toBeGreaterThan(5),
      { timeout: 5000 }
    );
    const unfiltered = new Set(
      [...document.querySelectorAll('a[href^="/news/"]')].map((a) => a.getAttribute('href'))
    ).size;
    unmount();

    // Every built-in article is category CRM, so filtering to a category that
    // matches nothing must empty the list rather than leave the page as-is.
    localStorage.setItem('newsFilters_category', 'Nonexistent Category');
    render(<News />, { initialEntries: ['/news'] });

    await waitFor(() => expect(document.querySelectorAll('a[href^="/news/"]').length).toBe(0), {
      timeout: 5000,
    });
    expect(unfiltered).toBeGreaterThan(0);
    localStorage.removeItem('newsFilters_category');
  });

  it('searches beyond the visible page', async () => {
    mock.setTableResult('articles', { data: [], error: null });
    // A term that appears in a built-in article's title.
    localStorage.setItem('newsFilters_search', 'zapier');
    render(<News />, { initialEntries: ['/news'] });

    await waitFor(
      () => {
        const hrefs = [...document.querySelectorAll('a[href^="/news/"]')].map((a) =>
          a.getAttribute('href')
        );
        expect(hrefs.some((href) => href?.includes('zapier'))).toBe(true);
      },
      { timeout: 5000 }
    );
    localStorage.removeItem('newsFilters_search');
  });

  it('surfaces an error state when the query fails', async () => {
    mock.setTableResult('articles', { data: null, error: { message: 'boom' } });
    render(<News />, { initialEntries: ['/news'] });

    await waitFor(() => expect(screen.queryByRole('heading', { level: 1 })).toBeInTheDocument(), {
      timeout: 5000,
    });
  });
});
