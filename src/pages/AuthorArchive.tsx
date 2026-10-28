import { useQuery } from '@tanstack/react-query';
import { useParams, Navigate, Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import StructuredData from '../components/SEO/StructuredData';
import { ArticleCard } from '../components/ArticleCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, User, Award, Briefcase } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { ArticleListSkeleton } from '@/components/skeletons';
import Breadcrumbs from '@/components/Breadcrumbs';
import { SEO_CONFIG, getCanonicalUrl, getArchiveMetadata } from '@/lib/seo';
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

const AuthorArchive = () => {
  const { author: rawAuthor } = useParams<{ author: string }>();
  // The query below matches the author with ilike, so case does not matter
  // and the param can be normalised to a lowercase slug.
  const validAuthor = rawAuthor ? validateUrlParam(decodeParam(rawAuthor)) : null;
  const author = validAuthor ? validAuthor.toLowerCase().replace(/\s+/g, '-') : null;

  const {
    data: articles,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['articles', 'author', author],
    queryFn: async () => {
      if (!author) throw new Error('No author provided');

      // Convert slug back to author name format
      const authorName = author
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const { data, error } = await supabase
        .from('articles')
        .select(
          'id, slug, title, excerpt, category, tags, image_url, created_at, read_time, view_count, featured, author'
        )
        .eq('published', true)
        .ilike('author', authorName)
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Same as the other archives: the built-in articles have an author and
      // are linked from their own pages, so they belong here too.
      const authorLower = authorName.toLowerCase();
      const builtIn = selectStaticArticles(
        (article) => article.author?.toLowerCase() === authorLower,
        await fetchSeededStaticSlugs()
      );

      return sortArticleListing([...(data as Article[]), ...builtIn]) as Article[];
    },
    enabled: !!author,
  });

  if (!author) {
    return <Navigate to="/news" replace />;
  }

  // A failed load or an author with no articles is a thin page; keep it out
  // of the index.
  const noIndex = !isLoading && (!!error || (articles?.length ?? 0) === 0);
  const authorPath = `/author/${encodeURIComponent(author)}`;

  // Format author name for display
  const authorDisplay = author
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Get unique categories and tags from this author's articles
  const authorCategories = articles
    ? Array.from(new Set(articles.map((a) => a.category).filter(Boolean)))
    : [];
  const authorTags = articles
    ? Array.from(new Set(articles.flatMap((a) => a.tags || []))).slice(0, 10)
    : [];

  // Generate SEO metadata
  const seoData = getArchiveMetadata('author', author, articles?.length || 0);

  // Breadcrumb items for visual component (label/path format)
  const breadcrumbItems = [
    { label: 'News', path: '/news' },
    { label: authorDisplay, path: authorPath },
  ];

  // Breadcrumb items for structured data (name/url format)
  const structuredBreadcrumbs = [
    { name: 'Home', url: getCanonicalUrl('/') },
    { name: 'News', url: getCanonicalUrl('/news') },
    { name: authorDisplay, url: getCanonicalUrl(authorPath) },
  ];

  // Check if this is the main author (Dan Pearson)
  const isMainAuthor = authorDisplay.toLowerCase() === 'dan pearson';

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SEO
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        url={getCanonicalUrl(authorPath)}
        type="website"
        noIndex={noIndex}
      />

      {/* Breadcrumb Schema */}
      <StructuredData type="breadcrumb" data={{ items: structuredBreadcrumbs }} />

      {/* Author/Person Schema for E-E-A-T */}
      <StructuredData
        type="person"
        data={{
          name: authorDisplay,
          url: isMainAuthor ? SEO_CONFIG.author.url : getCanonicalUrl(authorPath),
          jobTitle: isMainAuthor ? SEO_CONFIG.author.jobTitle : 'Contributing Writer',
          worksFor: {
            '@type': 'Organization',
            name: SEO_CONFIG.author.company,
          },
          sameAs: isMainAuthor ? [SEO_CONFIG.author.linkedin, SEO_CONFIG.author.github] : [],
        }}
      />

      <Navigation />

      <main id="main-content" className="flex-1 pt-20 px-4 md:px-6 pb-16">
        <div className="container mx-auto max-w-7xl">
          {/* Breadcrumbs */}
          <Breadcrumbs items={breadcrumbItems} className="mb-6" />

          {/* Author Header */}
          <div className="mb-12">
            <div className="flex flex-col md:flex-row md:items-start gap-6 mb-6">
              {/* Author Avatar */}
              <div className="flex-shrink-0">
                <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                  <User className="w-12 h-12 text-tech-cyan" aria-hidden="true" />
                </div>
              </div>

              {/* Author Info */}
              <div className="flex-grow">
                <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
                  {authorDisplay}
                </h1>

                {isMainAuthor && (
                  <div className="flex items-center gap-2 text-tech-cyan mb-4">
                    <Briefcase className="w-4 h-4" aria-hidden="true" />
                    <span>{SEO_CONFIG.author.jobTitle}</span>
                  </div>
                )}

                <p className="text-xl text-muted-foreground mb-4">
                  {isMainAuthor
                    ? 'AI automation expert helping businesses transform their operations through intelligent solutions.'
                    : `Contributing author with ${articles?.length || 0} published articles on AI, automation, and technology.`}
                </p>

                {/* Author Stats */}
                <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Award className="w-4 h-4" aria-hidden="true" />
                    <span>{articles?.length || 0} Articles Published</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span>{authorCategories.length} Topics Covered</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Categories written about */}
            {authorCategories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="text-sm text-muted-foreground">Writes about:</span>
                {authorCategories.map((category) => (
                  <Link key={category} to={`/news/category/${category}`}>
                    <Badge
                      variant="secondary"
                      className="hover:bg-tech-cyan/10 transition-colors cursor-pointer"
                    >
                      {category}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}

            {/* Related Tags */}
            {authorTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="text-sm text-muted-foreground">Topics:</span>
                {authorTags.map((tag) => (
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
              <User className="w-16 h-16 text-muted-foreground mx-auto mb-4" aria-hidden="true" />
              <h2 className="text-2xl font-semibold mb-2">No articles found</h2>
              <p className="text-muted-foreground mb-6">
                There are no published articles by this author yet.
              </p>
              <Button asChild>
                <Link to="/news">Browse All Articles</Link>
              </Button>
            </div>
          )}

          {/* Articles Grid */}
          {!isLoading && !error && articles && articles.length > 0 && (
            <>
              <h2 className="text-2xl font-bold mb-6">Articles by {authorDisplay}</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {articles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>

              {/* Article Count */}
              <div className="mt-12 text-center text-muted-foreground">
                Showing {articles.length} {articles.length === 1 ? 'article' : 'articles'} by{' '}
                {authorDisplay}
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default AuthorArchive;
