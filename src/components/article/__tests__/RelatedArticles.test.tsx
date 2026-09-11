import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@/test/test-utils';
import type { SupabaseMock } from '@/test/mocks/supabase';
import { CRM_ARTICLE_INDEX } from '@/content/crm-article-index.generated';

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  return { supabase: createSupabaseMock() };
});

import { supabase } from '@/integrations/supabase/client';
import RelatedArticles from '../RelatedArticles';

const mock = supabase as unknown as SupabaseMock;
const current = CRM_ARTICLE_INDEX[0];

/** Every .neq() argument list across every query builder this render created. */
const neqCalls = (): unknown[][] =>
  mock.from.mock.results.flatMap(
    (result) => (result.value as { neq: { mock: { calls: unknown[][] } } }).neq.mock.calls
  );

beforeEach(() => {
  mock.resetTableResults();
  mock.setTableResult('articles', { data: [], error: null });
});

describe('RelatedArticles on a built-in article', () => {
  it('offers the other built-in articles when the database has none', async () => {
    render(
      <RelatedArticles
        currentArticleId={`static-${current.slug}`}
        currentArticleSlug={current.slug}
        category={current.category}
        tags={current.tags}
      />
    );

    // The heading also renders in the loading skeleton, so wait for real links.
    await waitFor(() => expect(screen.getAllByRole('link').length).toBeGreaterThan(0));
  });

  it('never offers the article being read', async () => {
    render(
      <RelatedArticles
        currentArticleId={`static-${current.slug}`}
        currentArticleSlug={current.slug}
        category={current.category}
        tags={current.tags}
      />
    );

    await waitFor(() => expect(screen.getAllByRole('link').length).toBeGreaterThan(0));
    expect(screen.queryByText(current.title)).not.toBeInTheDocument();
  });

  it('does not send a synthetic id to a uuid column, which failed the whole query', async () => {
    render(
      <RelatedArticles
        currentArticleId={`static-${current.slug}`}
        currentArticleSlug={current.slug}
        category={current.category}
        tags={current.tags}
      />
    );

    await waitFor(() => expect(screen.getAllByRole('link').length).toBeGreaterThan(0));
    expect(neqCalls()).not.toContainEqual(['id', `static-${current.slug}`]);
  });

  it('still filters by id for a real database article', async () => {
    const uuid = '11111111-2222-3333-4444-555555555555';
    render(
      <RelatedArticles
        currentArticleId={uuid}
        currentArticleSlug="a-database-article"
        category={current.category}
        tags={current.tags}
      />
    );

    await waitFor(() => expect(neqCalls()).toContainEqual(['id', uuid]));
  });
});
