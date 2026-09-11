import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSupabaseMock } from '@/test/mocks/supabase';
import { CRM_ARTICLE_INDEX } from '@/content/crm-article-index.generated';

const supabase = createSupabaseMock({ data: [] });
vi.mock('@/integrations/supabase/client', () => ({ supabase }));

const { selectStaticArticles, fetchSeededStaticSlugs } = await import('../static-articles');

describe('selectStaticArticles', () => {
  const sample = CRM_ARTICLE_INDEX[0];

  it('returns the built-in articles matching the predicate', () => {
    const hits = selectStaticArticles((a) => a.slug === sample.slug);
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ slug: sample.slug, title: sample.title });
  });

  it('matches on a tag the way an archive URL spells it', () => {
    const tagSlug = sample.tags[0].toLowerCase().replace(/\s+/g, '-');
    const hits = selectStaticArticles(
      (a) => a.tags?.some((t) => t.toLowerCase().replace(/\s+/g, '-') === tagSlug) ?? false
    );
    expect(hits.some((a) => a.slug === sample.slug)).toBe(true);
  });

  it('drops slugs the caller already covers', () => {
    expect(
      selectStaticArticles(() => true, [sample.slug]).some((a) => a.slug === sample.slug)
    ).toBe(false);
  });

  it('returns nothing when the predicate matches nothing', () => {
    expect(selectStaticArticles(() => false)).toEqual([]);
  });
});

describe('fetchSeededStaticSlugs', () => {
  beforeEach(() => {
    supabase.setTableResult('articles', { data: [], error: null });
  });

  it('reports the slugs that already have rows', async () => {
    supabase.setTableResult('articles', {
      data: [{ slug: CRM_ARTICLE_INDEX[0].slug }],
      error: null,
    });
    const seeded = await fetchSeededStaticSlugs();
    expect(seeded.has(CRM_ARTICLE_INDEX[0].slug)).toBe(true);
    expect(seeded.size).toBe(1);
  });

  it('excludes nothing when the lookup fails, so the archive keeps its articles', async () => {
    supabase.setTableResult('articles', { data: null, error: { message: 'boom' } });
    await expect(fetchSeededStaticSlugs()).resolves.toEqual(new Set());
  });
});
