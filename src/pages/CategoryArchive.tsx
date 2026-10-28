import { useQuery } from '@tanstack/react-query';
import { useParams, Navigate, Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import { ArticleCard } from '../components/ArticleCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, FolderOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { ArticleListSkeleton } from '@/components/skeletons';
import Breadcrumbs from '@/components/Breadcrumbs';
import { validateUrlParam } from '@/lib/security';
import {
  fetchSeededStaticSlugs,
  selectStaticArticles,
  sortArticleListing,
} from '@/lib/static-articles';

type Article = Tables<'articles'>;

// useParams hands back what the router matched; a link that was encoded twice
// (or typed with %20) still arrives escaped. Decode once, tolerating bad input.
const decodeParam = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const CategoryArchive = () => {
  const { category: rawCategory } = useParams<{ category: string }>();
  // Category rows are matched exactly (.eq below), so the case is part of the
  // key and is not lowered here; only the escaping is undone.
  const category = rawCategory ? validateUrlParam(decodeParam(rawCategory)) : null;

  const {
    data: articles,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['articles', 'category', category],
    queryFn: async () => {
      if (!category) throw new Error('No category provided');

      const { data, error } = await supabase
        .from('articles')
        .select(
          'id, slug, title, excerpt, category, tags, image_url, created_at, read_time, view_count, featured, author'
        )
        .eq('published', true)
        .eq('category', category)
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // The query above can only see rows, so a category archive reached from a
      // prerendered article would come back empty (US-074/US-082).
      const categoryLower = category.toLowerCase();
      const builtIn = selectStaticArticles(
        (article) => article.category?.toLowerCase() === categoryLower,
        await fetchSeededStaticSlugs()
      );

      return sortArticleListing([...(data as Article[]), ...builtIn]) as Article[];
    },
    enabled: !!category,
  });

  // Get unique tags from articles in this category
  const categoryTags = articles
    ? Array.from(new Set(articles.flatMap((a) => a.tags || []))).sort()
    : [];

  if (!category) {
    return <Navigate to="/news" replace />;
  }

  // The canonical uses the category as stored on the matched articles, so
  // /news/category/ai and /news/category/AI do not both claim to be canonical.
  const canonicalCategory =
    articles?.find((a) => a.category?.toLowerCase() === category.toLowerCase())?.category ??
    category;
  const canonicalPath = `/news/category/${encodeURIComponent(canonicalCategory)}`;

  // A failed load or an empty category is a thin page; keep it out of the index.
  const noIndex = !isLoading && (!!error || (articles?.length ?? 0) === 0);

  // Format category name for display
  const categoryDisplay = category
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Generate SEO-friendly description
  const categoryDescription = `Explore ${articles?.length || 'our collection of'} articles about ${categoryDisplay}. Stay updated with the latest insights, trends, and expert analysis.`;
  const categoryKeywords = `${categoryDisplay}, ${category} articles, ${category} insights, ${categoryTags.slice(0, 5).join(', ')}`;

  const breadcrumbItems = [
    { label: 'Home', path: '/' },
    { label: 'News', path: '/news' },
    { label: categoryDisplay, path: canonicalPath },
  ];

  const breadcrumbStructuredData = breadcrumbItems.map((item) => ({
    name: item.label,
    url: `https://danpearson.net${item.path === '/' ? '' : item.path}`,
  }));

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SEO
        title={`${categoryDisplay} Articles - Dan Pearson`}
        description={categoryDescription}
        keywords={categoryKeywords}
        url={`https://danpearson.net${canonicalPath}`}
        type="website"
        noIndex={noIndex}
        structuredData={{
          type: 'breadcrumb',
          data: { items: breadcrumbStructuredData },
        }}
      />

      <Navigation />

      <main id="main-content" className="flex-1 pt-20 px-4 md:px-6 pb-16">
        <div className="container mx-auto max-w-7xl">
          {/* Breadcrumbs */}
          <Breadcrumbs items={breadcrumbItems} className="mb-6" />

          {/* Category Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <FolderOpen className="w-8 h-8 text-tech-cyan" aria-hidden="true" />
              <h1 className="text-4xl md:text-5xl font-bold text-foreground">{categoryDisplay}</h1>
            </div>
            <p className="text-xl text-muted-foreground mb-6">{categoryDescription}</p>

            {/* Category Tags */}
            {categoryTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="text-sm text-muted-foreground">Related topics:</span>
                {categoryTags.slice(0, 8).map((tag) => (
                  <Link key={tag} to={`/news/tag/${tag.toLowerCase().replace(/\s+/g, '-')}`}>
                    <Badge
                      variant="outline"
                      className="hover:bg-tech-cyan/10 hover:border-tech-cyan transition-colors cursor-pointer"
                    >
                      {tag}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}

            {/* Back to News Button */}
            <Button variant="outline" className="gap-2" asChild>
              <Link to="/news">
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                Back to All Articles
              </Link>
            </Button>
          </div>

          {/* Loading State */}
          {isLoading && <ArticleListSkeleton count={6} />}

          {/* Error State */}
          {error && (
            <div className="text-center py-12" role="alert">
              <p className="text-destructive mb-4">Failed to load articles</p>
              <Button onClick={() => refetch()} disabled={isFetching}>
                {isFetching ? 'Retrying' : 'Try Again'}
              </Button>
            </div>
          )}

          {/* No Articles Found */}
          {!isLoading && !error && articles?.length === 0 && (
            <div className="text-center py-12">
              <FolderOpen
                className="w-16 h-16 text-muted-foreground mx-auto mb-4"
                aria-hidden="true"
              />
              <h2 className="text-2xl font-semibold mb-2">No articles found</h2>
              <p className="text-muted-foreground mb-6">
                There are no published articles in this category yet.
              </p>
              <Button asChild>
                <Link to="/news">Browse All Articles</Link>
              </Button>
            </div>
          )}

          {/* Articles Grid */}
          {!isLoading && !error && articles && articles.length > 0 && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {articles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>

              {/* Article Count */}
              <div className="mt-12 text-center text-muted-foreground">
                Showing {articles.length} {articles.length === 1 ? 'article' : 'articles'} in{' '}
                {categoryDisplay}
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default CategoryArchive;
