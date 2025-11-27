import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Clock, Eye, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type Article = Tables<"articles">;

interface RelatedArticlesProps {
  currentArticleId: string;
  category: string;
  tags: string[];
  maxArticles?: number;
}

/**
 * RelatedArticles component for internal linking SEO
 * Uses intelligent matching based on:
 * 1. Tag overlap (highest priority)
 * 2. Same category (secondary)
 * 3. Recency (tiebreaker)
 */
const RelatedArticles = ({
  currentArticleId,
  category,
  tags,
  maxArticles = 3
}: RelatedArticlesProps) => {
  const { data: relatedArticles, isLoading } = useQuery({
    queryKey: ['related-articles-smart', currentArticleId, category, tags],
    queryFn: async () => {
      // Fetch candidates from same category or with overlapping tags
      const { data, error } = await supabase
        .from('articles')
        .select('id, slug, title, excerpt, category, image_url, created_at, read_time, view_count, tags')
        .eq('published', true)
        .neq('id', currentArticleId)
        .order('created_at', { ascending: false })
        .limit(20); // Fetch more to score and filter

      if (error) throw error;
      if (!data) return [];

      // Score and rank articles by relevance
      const scoredArticles = data.map(article => {
        let score = 0;

        // Tag overlap scoring (highest weight)
        const articleTags = article.tags || [];
        const tagOverlap = tags.filter(tag =>
          articleTags.some(aTag =>
            aTag.toLowerCase() === tag.toLowerCase()
          )
        ).length;
        score += tagOverlap * 10;

        // Category match (medium weight)
        if (article.category === category) {
          score += 5;
        }

        // Recency bonus (small weight for recent articles)
        const daysSincePublished = Math.floor(
          (Date.now() - new Date(article.created_at || '').getTime()) / (1000 * 60 * 60 * 24)
        );
        if (daysSincePublished < 30) {
          score += 2;
        } else if (daysSincePublished < 90) {
          score += 1;
        }

        return { ...article, relevanceScore: score };
      });

      // Sort by score (descending) and take top N
      return scoredArticles
        .filter(a => a.relevanceScore > 0) // Only show related content
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, maxArticles) as Article[];
    },
    enabled: !!currentArticleId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  if (isLoading) {
    return (
      <div className="mt-16 pt-12 border-t border-border">
        <h2 className="text-2xl md:text-3xl font-bold mb-8">Related Articles</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse bg-gray-800/50 rounded-lg p-4">
              <div className="aspect-video bg-gray-700/50 rounded mb-4" />
              <div className="h-4 bg-gray-700/50 rounded mb-2 w-1/4" />
              <div className="h-6 bg-gray-700/50 rounded mb-2" />
              <div className="h-4 bg-gray-700/50 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!relatedArticles || relatedArticles.length === 0) {
    return null;
  }

  return (
    <section
      className="mt-16 pt-12 border-t border-border"
      aria-labelledby="related-articles-heading"
    >
      <div className="flex items-center justify-between mb-8">
        <h2
          id="related-articles-heading"
          className="text-2xl md:text-3xl font-bold"
        >
          Related Articles
        </h2>
        <Link
          to="/news"
          className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-sm"
        >
          View all articles
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {relatedArticles.map((relatedArticle) => (
          <article
            key={relatedArticle.id}
            className="group"
            itemScope
            itemType="https://schema.org/Article"
          >
            <Link
              to={`/news/${relatedArticle.slug}`}
              className="block mobile-card bg-gray-800/50 border border-gray-700 hover:border-cyan-500/50 transition-all duration-200 h-full"
            >
              {relatedArticle.image_url && (
                <div className="aspect-video rounded-t-lg overflow-hidden">
                  <img
                    src={relatedArticle.image_url}
                    alt={relatedArticle.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                    itemProp="image"
                  />
                </div>
              )}
              <div className="p-4">
                <Badge
                  className="bg-primary/10 text-primary border-primary/20 mb-3"
                  itemProp="articleSection"
                >
                  {relatedArticle.category}
                </Badge>
                <h3
                  className="text-lg font-semibold mb-2 group-hover:text-cyan-400 transition-colors line-clamp-2"
                  itemProp="headline"
                >
                  {relatedArticle.title}
                </h3>
                <p
                  className="text-sm text-muted-foreground line-clamp-2"
                  itemProp="description"
                >
                  {relatedArticle.excerpt}
                </p>
                <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" aria-hidden="true" />
                    <span>{relatedArticle.read_time}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Eye className="w-3 h-3" aria-hidden="true" />
                    <span>{relatedArticle.view_count || 0} views</span>
                  </span>
                </div>
              </div>
            </Link>
          </article>
        ))}
      </div>

      {/* SEO: Internal linking hint */}
      <p className="sr-only">
        Explore more articles about {category} and related topics on Dan Pearson's blog.
      </p>
    </section>
  );
};

export default RelatedArticles;
