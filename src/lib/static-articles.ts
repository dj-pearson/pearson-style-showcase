import { CRM_ARTICLE_INDEX } from '@/content/crm-article-index.generated';

/**
 * The shape a listing page needs from an article, whichever source it came
 * from. Deliberately narrower than Tables<'articles'> - a listing renders a
 * card, not a body.
 */
export interface ArticleListing {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  category: string | null;
  tags: string[] | null;
  image_url: string | null;
  created_at: string;
  read_time: string | null;
  view_count: number | null;
  featured: boolean | null;
  author: string | null;
}

/**
 * Merges the articles built into the site with whatever the database returned.
 *
 * A database row always wins on a slug collision: once an article is seeded it
 * can be edited in the admin, and the edited copy is the truth. The static
 * entries exist to cover articles that are prerendered and linked but have no
 * row yet (US-074), which without this are absent from every listing on the
 * site even though their pages render (US-082).
 */
export function mergeStaticArticles<T extends { slug: string }>(
  rows: T[] | null | undefined
): (T | ArticleListing)[] {
  const fromDatabase = rows ?? [];
  const seen = new Set(fromDatabase.map((row) => row.slug));

  const missing: ArticleListing[] = CRM_ARTICLE_INDEX.filter(
    (article) => !seen.has(article.slug)
  ).map((article) => ({
    id: `static-${article.slug}`,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    category: article.category,
    tags: article.tags,
    image_url: null,
    created_at: `${article.published_at}T12:00:00.000Z`,
    read_time: article.read_time,
    // No row means no recorded views. Zero rather than a fabricated number, so
    // "popular" orderings stay honest.
    view_count: 0,
    featured: article.featured,
    author: article.author,
  }));

  return [...fromDatabase, ...missing];
}

/**
 * Featured first, then newest. The database queries already order this way, so
 * a merged list has to be re-sorted or the appended entries all land at the end
 * regardless of date.
 */
export function sortArticleListing<
  T extends { featured?: boolean | null; created_at?: string | null },
>(articles: T[]): T[] {
  return [...articles].sort((a, b) => {
    if (Boolean(a.featured) !== Boolean(b.featured)) return a.featured ? -1 : 1;
    return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
  });
}
