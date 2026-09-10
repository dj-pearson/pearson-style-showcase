import { describe, it, expect } from 'vitest';
import { mergeStaticArticles, sortArticleListing } from '../static-articles';
import { CRM_ARTICLE_INDEX } from '@/content/crm-article-index.generated';

describe('mergeStaticArticles', () => {
  it('adds every built-in article when the database returns nothing', () => {
    expect(mergeStaticArticles([])).toHaveLength(CRM_ARTICLE_INDEX.length);
    expect(mergeStaticArticles(null)).toHaveLength(CRM_ARTICLE_INDEX.length);
  });

  it('lets a database row win over the built-in copy of the same slug', () => {
    const slug = CRM_ARTICLE_INDEX[0].slug;
    const merged = mergeStaticArticles([{ slug, title: 'Edited in the admin' }]);

    expect(merged.filter((a) => a.slug === slug)).toHaveLength(1);
    expect(merged.find((a) => a.slug === slug)).toMatchObject({ title: 'Edited in the admin' });
    expect(merged).toHaveLength(CRM_ARTICLE_INDEX.length);
  });

  it('keeps database rows that have no built-in counterpart', () => {
    const merged = mergeStaticArticles([{ slug: 'some-other-article' }]);
    expect(merged.some((a) => a.slug === 'some-other-article')).toBe(true);
    expect(merged).toHaveLength(CRM_ARTICLE_INDEX.length + 1);
  });

  it('reports no views for an article with no row, rather than inventing any', () => {
    const merged = mergeStaticArticles([]) as { view_count: number }[];
    expect(merged.every((a) => a.view_count === 0)).toBe(true);
  });
});

describe('sortArticleListing', () => {
  it('puts featured first, then newest', () => {
    const sorted = sortArticleListing([
      { slug: 'old', featured: false, created_at: '2026-01-01T00:00:00Z' },
      { slug: 'new', featured: false, created_at: '2026-06-01T00:00:00Z' },
      { slug: 'star', featured: true, created_at: '2025-01-01T00:00:00Z' },
    ]);
    expect(sorted.map((a) => a.slug)).toEqual(['star', 'new', 'old']);
  });

  it('does not mutate its input', () => {
    const input = [
      { slug: 'a', featured: false, created_at: '2026-01-01T00:00:00Z' },
      { slug: 'b', featured: true, created_at: '2026-01-01T00:00:00Z' },
    ];
    sortArticleListing(input);
    expect(input.map((a) => a.slug)).toEqual(['a', 'b']);
  });
});
