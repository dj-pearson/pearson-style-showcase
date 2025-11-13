import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, Eye } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Article {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  tags: string[];
  image_url: string | null;
  read_time: string | null;
  view_count: number | null;
  created_at: string;
}

interface RelatedArticlesProps {
  currentArticleId: string;
  currentTags?: string[];
  currentCategory?: string;
  limit?: number;
}

const RelatedArticles = ({
  currentArticleId,
  currentTags = [],
  currentCategory,
  limit = 3
}: RelatedArticlesProps) => {

  const { data: relatedArticles, isLoading } = useQuery({
    queryKey: ['related-articles', currentArticleId, currentTags, currentCategory],
    queryFn: async () => {
      // Strategy: Find articles with matching tags or category
      // Prioritize tag matches, then category matches

      let query = supabase
        .from('articles')
        .select('id, title, slug, excerpt, category, tags, image_url, read_time, view_count, created_at')
        .eq('published', true)
        .neq('id', currentArticleId);

      // Build a relevance-based query
      const articles: Article[] = [];

      // First: Get articles with matching tags
      if (currentTags.length > 0) {
        const { data: tagMatches } = await query
          .overlaps('tags', currentTags)
          .limit(limit * 2); // Get more to filter

        if (tagMatches) {
          articles.push(...tagMatches);
        }
      }

      // Second: Get articles from same category if we need more
      if (articles.length < limit && currentCategory) {
        const { data: categoryMatches } = await query
          .eq('category', currentCategory)
          .limit(limit * 2);

        if (categoryMatches) {
          // Add articles that aren't already in the list
          const existingIds = new Set(articles.map(a => a.id));
          const newArticles = categoryMatches.filter(a => !existingIds.has(a.id));
          articles.push(...newArticles);
        }
      }

      // Third: Get recent articles if we still need more
      if (articles.length < limit) {
        const { data: recentArticles } = await query
          .order('created_at', { ascending: false })
          .limit(limit * 2);

        if (recentArticles) {
          const existingIds = new Set(articles.map(a => a.id));
          const newArticles = recentArticles.filter(a => !existingIds.has(a.id));
          articles.push(...newArticles);
        }
      }

      // Calculate relevance score and sort
      const scoredArticles = articles.map(article => {
        let score = 0;

        // Points for tag matches
        const matchingTags = article.tags?.filter(tag => currentTags.includes(tag)) || [];
        score += matchingTags.length * 3;

        // Points for category match
        if (article.category === currentCategory) {
          score += 2;
        }

        // Points for recency (newer = better)
        const daysOld = (Date.now() - new Date(article.created_at).getTime()) / (1000 * 60 * 60 * 24);
        if (daysOld < 30) score += 1;

        // Points for popularity (view count)
        if (article.view_count && article.view_count > 100) score += 1;

        return { ...article, relevanceScore: score };
      });

      // Sort by relevance and return top results
      return scoredArticles
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limit);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Related Articles</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-32 bg-muted rounded-md mb-4"></div>
                <div className="h-6 bg-muted rounded w-3/4 mb-2"></div>
                <div className="h-4 bg-muted rounded w-full"></div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!relatedArticles || relatedArticles.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">You Might Also Like</h2>
        <Link
          to="/news"
          className="text-sm text-primary hover:underline flex items-center gap-1"
        >
          View all articles
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {relatedArticles.map((article) => (
          <Link
            key={article.id}
            to={`/news/${article.slug}`}
            className="group"
          >
            <Card className="h-full transition-all duration-200 hover:shadow-lg hover:scale-[1.02] hover:border-primary/50">
              {article.image_url && (
                <div className="relative overflow-hidden rounded-t-lg aspect-video">
                  <img
                    src={article.image_url}
                    alt={article.title}
                    className="object-cover w-full h-full transition-transform duration-200 group-hover:scale-110"
                    loading="lazy"
                  />
                  {article.category && (
                    <Badge
                      className="absolute top-2 right-2 bg-background/80 backdrop-blur-sm"
                      variant="secondary"
                    >
                      {article.category}
                    </Badge>
                  )}
                </div>
              )}

              <CardHeader className="space-y-2">
                <CardTitle className="line-clamp-2 group-hover:text-primary transition-colors">
                  {article.title}
                </CardTitle>
                <CardDescription className="line-clamp-2">
                  {article.excerpt}
                </CardDescription>
              </CardHeader>

              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  {article.read_time && (
                    <div className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      <span>{article.read_time}</span>
                    </div>
                  )}
                  {article.view_count && article.view_count > 0 && (
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span>{article.view_count.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {article.tags && article.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap mt-3">
                    {article.tags.slice(0, 3).map((tag, idx) => (
                      <Badge
                        key={idx}
                        variant="outline"
                        className="text-xs"
                      >
                        {tag}
                      </Badge>
                    ))}
                    {article.tags.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{article.tags.length - 3}
                      </Badge>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default RelatedArticles;
