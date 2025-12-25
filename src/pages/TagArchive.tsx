import { useQuery } from '@tanstack/react-query';
import { useParams, Navigate, Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import { ArticleCard } from '../components/ArticleCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Tag as TagIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { ArticleListSkeleton } from '@/components/skeletons';
import Breadcrumbs from '@/components/Breadcrumbs';

type Article = Tables<"articles">;

const TagArchive = () => {
  const { tag } = useParams<{ tag: string }>();

  const { data: articles, isLoading, error } = useQuery({
    queryKey: ['articles', 'tag', tag],
    queryFn: async () => {
      if (!tag) throw new Error('No tag provided');

      // Fetch all published articles and filter by tag
      const { data, error } = await supabase
        .from('articles')
        .select('id, slug, title, excerpt, category, tags, image_url, created_at, read_time, view_count, featured, author')
        .eq('published', true)
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Filter articles that have this tag (case-insensitive)
      const tagLower = tag.toLowerCase();
      const filtered = (data as Article[]).filter(article =>
        article.tags?.some(t => t.toLowerCase().replace(/\s+/g, '-') === tagLower)
      );

      return filtered;
    },
    enabled: !!tag,
  });

  // Get unique categories from articles with this tag
  const tagCategories = articles
    ? Array.from(new Set(articles.map(a => a.category).filter(Boolean))).sort()
    : [];

  // Get related tags
  const relatedTags = articles
    ? Array.from(new Set(articles.flatMap(a => a.tags || [])
        .filter(t => t.toLowerCase().replace(/\s+/g, '-') !== tag?.toLowerCase())))
        .sort()
        .slice(0, 8)
    : [];

  if (!tag) {
    return <Navigate to="/news" replace />;
  }

  // Format tag name for display
  const tagDisplay = tag
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  // Generate SEO-friendly description
  const tagDescription = `Discover ${articles?.length || 'our collection of'} articles tagged with ${tagDisplay}. Expert insights, tutorials, and analysis.`;
  const tagKeywords = `${tagDisplay}, ${tag} articles, ${tagCategories.join(', ')}, ${relatedTags.slice(0, 5).join(', ')}`;

  const breadcrumbItems = [
    { name: 'Home', url: 'https://danpearson.net' },
    { name: 'News', url: 'https://danpearson.net/news' },
    { name: tagDisplay, url: `https://danpearson.net/news/tag/${tag}` }
  ];

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-950 via-gray-900 to-black text-white">
      <SEO
        title={`${tagDisplay} - Dan Pearson`}
        description={tagDescription}
        keywords={tagKeywords}
        url={`https://danpearson.net/news/tag/${tag}`}
        type="website"
        structuredData={{
          type: 'breadcrumb',
          data: { items: breadcrumbItems }
        }}
      />

      <Navigation />

      <main id="main-content" className="flex-1 pt-20 px-4 md:px-6 pb-16">
        <div className="container mx-auto max-w-7xl">
          {/* Breadcrumbs */}
          <Breadcrumbs items={breadcrumbItems} className="mb-6" />

          {/* Tag Header */}
          <div className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <TagIcon className="w-8 h-8 text-tech-cyan" />
              <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                {tagDisplay}
              </h1>
            </div>
            <p className="text-xl text-gray-400 mb-6">
              {tagDescription}
            </p>

            {/* Categories */}
            {tagCategories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="text-sm text-gray-500">Categories:</span>
                {tagCategories.map(category => (
                  <Link
                    key={category}
                    to={`/news/category/${category}`}
                  >
                    <Badge variant="secondary" className="hover:bg-tech-cyan/10 hover:border-tech-cyan transition-colors cursor-pointer">
                      {category?.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}

            {/* Related Tags */}
            {relatedTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-6">
                <span className="text-sm text-gray-500">Related tags:</span>
                {relatedTags.map(relatedTag => (
                  <Link
                    key={relatedTag}
                    to={`/news/tag/${relatedTag.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <Badge variant="outline" className="hover:bg-tech-cyan/10 hover:border-tech-cyan transition-colors cursor-pointer">
                      {relatedTag}
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
              <TagIcon className="w-16 h-16 text-gray-700 mx-auto mb-4" />
              <h2 className="text-2xl font-semibold mb-2">No articles found</h2>
              <p className="text-gray-400 mb-6">
                There are no published articles with this tag yet.
              </p>
              <Link to="/news">
                <Button>Browse All Articles</Button>
              </Link>
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
              <div className="mt-12 text-center text-gray-500">
                Showing {articles.length} {articles.length === 1 ? 'article' : 'articles'} tagged with {tagDisplay}
              </div>
            </>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TagArchive;
