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

type Article = Tables<"articles">;

const AuthorArchive = () => {
  const { author } = useParams<{ author: string }>();

  const { data: articles, isLoading, error } = useQuery({
    queryKey: ['articles', 'author', author],
    queryFn: async () => {
      if (!author) throw new Error('No author provided');

      // Convert slug back to author name format
      const authorName = author
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');

      const { data, error } = await supabase
        .from('articles')
        .select('id, slug, title, excerpt, category, tags, image_url, created_at, read_time, view_count, featured, author')
        .eq('published', true)
        .ilike('author', authorName)
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Article[];
    },
    enabled: !!author,
  });

  if (!author) {
    return <Navigate to="/news" replace />;
  }

  // Format author name for display
  const authorDisplay = author
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Get unique categories and tags from this author's articles
  const authorCategories = articles
    ? Array.from(new Set(articles.map(a => a.category).filter(Boolean)))
    : [];
  const authorTags = articles
    ? Array.from(new Set(articles.flatMap(a => a.tags || []))).slice(0, 10)
    : [];

  // Generate SEO metadata
  const seoData = getArchiveMetadata('author', author, articles?.length || 0);

  // Breadcrumb items for visual component (label/path format)
  const breadcrumbItems = [
    { label: 'News', path: '/news' },
    { label: authorDisplay, path: `/author/${author}` }
  ];

  // Breadcrumb items for structured data (name/url format)
  const structuredBreadcrumbs = [
    { name: 'Home', url: getCanonicalUrl('/') },
    { name: 'News', url: getCanonicalUrl('/news') },
    { name: authorDisplay, url: getCanonicalUrl(`/author/${author}`) }
  ];

  // Check if this is the main author (Dan Pearson)
  const isMainAuthor = authorDisplay.toLowerCase() === 'dan pearson';

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
      <SEO
        title={seoData.title}
        description={seoData.description}
        keywords={seoData.keywords}
        url={getCanonicalUrl(`/author/${author}`)}
        type="website"
      />

      {/* Breadcrumb Schema */}
      <StructuredData
        type="breadcrumb"
        data={{ items: structuredBreadcrumbs }}
      />

      {/* Author/Person Schema for E-E-A-T */}
      <StructuredData
        type="person"
        data={{
          name: authorDisplay,
          url: isMainAuthor ? SEO_CONFIG.author.url : getCanonicalUrl(`/author/${author}`),
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
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-tech-cyan to-cyan-600 flex items-center justify-center">
                  <User className="w-12 h-12 text-white" />
                </div>
              </div>

              {/* Author Info */}
              <div className="flex-grow">
                <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent mb-2">
                  {authorDisplay}
                </h1>

                {isMainAuthor && (
                  <div className="flex items-center gap-2 text-tech-cyan mb-4">
                    <Briefcase className="w-4 h-4" />
                    <span>{SEO_CONFIG.author.jobTitle}</span>
                  </div>
                )}

                <p className="text-xl text-gray-400 mb-4">
                  {isMainAuthor
                    ? 'AI automation expert helping businesses transform their operations through intelligent solutions.'
                    : `Contributing author with ${articles?.length || 0} published articles on AI, automation, and technology.`}
                </p>

                {/* Author Stats */}
                <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                  <div className="flex items-center gap-1">
                    <Award className="w-4 h-4" />
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
                <span className="text-sm text-gray-500">Writes about:</span>
                {authorCategories.map(category => (
                  <Link
                    key={category}
                    to={`/news/category/${category}`}
                  >
                    <Badge variant="secondary" className="hover:bg-tech-cyan/10 transition-colors cursor-pointer">
                      {category}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}

            {/* Related Tags */}
            {authorTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="text-sm text-gray-500">Topics:</span>
                {authorTags.map(tag => (
                  <Link
                    key={tag}
                    to={`/news/tag/${tag.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Badge variant="outline" className="hover:bg-tech-cyan/10 hover:border-tech-cyan transition-colors cursor-pointer">
                      {tag}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}

            {/* Back to News Button */}
            <Link to="/news">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back to All Articles
              </Button>
            </Link>
          </div>

          {/* Loading State */}
          {isLoading && <ArticleListSkeleton count={6} />}

          {/* Error State */}
          {error && (
            <div className="text-center py-12">
              <p className="text-red-400 mb-4">Failed to load articles</p>
              <Button onClick={() => window.location.reload()}>
                Try Again
              </Button>
            </div>
          )}

          {/* No Articles Found */}
          {!isLoading && !error && articles?.length === 0 && (
            <div className="text-center py-12">
              <User className="w-16 h-16 text-gray-700 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">No articles found</h2>
              <p className="text-gray-400 mb-6">
                There are no published articles by this author yet.
              </p>
              <Link to="/news">
                <Button>Browse All Articles</Button>
              </Link>
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
              <div className="mt-12 text-center text-gray-500">
                Showing {articles.length} {articles.length === 1 ? 'article' : 'articles'} by {authorDisplay}
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
