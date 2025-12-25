import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ArrowRight, Layers, Tag, FolderOpen } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { generateSlug } from '@/lib/seo';

interface InternalLinksProps {
  currentCategory?: string;
  currentTags?: string[];
  excludeArticleId?: string;
  variant?: 'sidebar' | 'inline' | 'footer';
  maxLinks?: number;
}

/**
 * InternalLinks component for SEO-optimized internal linking
 * Displays contextually relevant links to categories, tags, and related content
 */
const InternalLinks = ({
  currentCategory,
  currentTags = [],
  excludeArticleId,
  variant = 'sidebar',
  maxLinks = 6,
}: InternalLinksProps) => {
  // Fetch all categories and tags for linking
  const { data: linkData } = useQuery({
    queryKey: ['internal-links-data'],
    queryFn: async () => {
      const { data: articles, error } = await supabase
        .from('articles')
        .select('id, category, tags')
        .eq('published', true);

      if (error) throw error;

      // Extract unique categories with counts
      const categoryCounts: Record<string, number> = {};
      const tagCounts: Record<string, number> = {};

      (articles || []).forEach(article => {
        if (article.category) {
          categoryCounts[article.category] = (categoryCounts[article.category] || 0) + 1;
        }
        (article.tags || []).forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      });

      return {
        categories: Object.entries(categoryCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
        tags: Object.entries(tagCounts)
          .map(([name, count]) => ({ name, count }))
          .sort((a, b) => b.count - a.count),
      };
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });

  if (!linkData) return null;

  // Determine which links to show based on context
  const relatedCategories = linkData.categories
    .filter(cat => cat.name !== currentCategory)
    .slice(0, 4);

  // Prioritize tags that overlap with current article
  const relatedTags = linkData.tags
    .filter(tag => !currentTags.includes(tag.name))
    .slice(0, maxLinks);

  // Topic hubs to promote
  const topicHubs = [
    { slug: 'ai-automation', title: 'AI Automation' },
    { slug: 'business-optimization', title: 'Business Optimization' },
    { slug: 'machine-learning', title: 'Machine Learning' },
    { slug: 'digital-transformation', title: 'Digital Transformation' },
  ];

  if (variant === 'inline') {
    return (
      <div className="my-8 p-6 bg-gray-900/50 rounded-lg border border-gray-800">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-tech-cyan" />
          Explore Related Content
        </h3>
        <div className="flex flex-wrap gap-2">
          {currentCategory && (
            <Link to={`/news/category/${currentCategory}`}>
              <Badge variant="secondary" className="hover:bg-tech-cyan/10 transition-colors">
                More in {currentCategory}
              </Badge>
            </Link>
          )}
          {currentTags.slice(0, 3).map(tag => (
            <Link key={tag} to={`/news/tag/${generateSlug(tag)}`}>
              <Badge variant="outline" className="hover:bg-tech-cyan/10 hover:border-tech-cyan transition-colors">
                {tag}
              </Badge>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'footer') {
    return (
      <section className="py-12 border-t border-gray-800">
        <div className="container mx-auto max-w-7xl">
          <h2 className="text-2xl font-bold mb-8 text-center">Explore More</h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Categories */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-tech-cyan" />
                Browse by Category
              </h3>
              <ul className="space-y-2">
                {relatedCategories.map(cat => (
                  <li key={cat.name}>
                    <Link
                      to={`/news/category/${cat.name}`}
                      className="text-gray-400 hover:text-tech-cyan transition-colors flex items-center justify-between"
                    >
                      <span>{cat.name}</span>
                      <span className="text-xs text-gray-600">{cat.count}</span>
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    to="/news"
                    className="text-tech-cyan hover:underline text-sm flex items-center gap-1"
                  >
                    View all <ArrowRight className="w-3 h-3" />
                  </Link>
                </li>
              </ul>
            </div>

            {/* Popular Tags */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Tag className="w-4 h-4 text-tech-cyan" />
                Popular Topics
              </h3>
              <div className="flex flex-wrap gap-2">
                {relatedTags.slice(0, 8).map(tag => (
                  <Link key={tag.name} to={`/news/tag/${generateSlug(tag.name)}`}>
                    <Badge
                      variant="outline"
                      className="hover:bg-tech-cyan/10 hover:border-tech-cyan transition-colors cursor-pointer"
                    >
                      {tag.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            </div>

            {/* Topic Hubs */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Layers className="w-4 h-4 text-tech-cyan" />
                Topic Guides
              </h3>
              <ul className="space-y-2">
                {topicHubs.map(hub => (
                  <li key={hub.slug}>
                    <Link
                      to={`/topics/${hub.slug}`}
                      className="text-gray-400 hover:text-tech-cyan transition-colors"
                    >
                      {hub.title}
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    to="/topics"
                    className="text-tech-cyan hover:underline text-sm flex items-center gap-1"
                  >
                    All topics <ArrowRight className="w-3 h-3" />
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Sidebar variant (default)
  return (
    <Card className="p-6 bg-gray-900/50 border-gray-800">
      <h3 className="font-semibold mb-4">Explore</h3>

      {/* Current Category */}
      {currentCategory && (
        <div className="mb-4">
          <Link
            to={`/news/category/${currentCategory}`}
            className="flex items-center gap-2 text-tech-cyan hover:underline"
          >
            <FolderOpen className="w-4 h-4" />
            More in {currentCategory}
          </Link>
        </div>
      )}

      {/* Related Tags */}
      {currentTags.length > 0 && (
        <div className="mb-4">
          <p className="text-sm text-gray-500 mb-2">Related topics:</p>
          <div className="flex flex-wrap gap-2">
            {currentTags.slice(0, 5).map(tag => (
              <Link key={tag} to={`/news/tag/${generateSlug(tag)}`}>
                <Badge
                  variant="outline"
                  className="hover:bg-tech-cyan/10 hover:border-tech-cyan transition-colors cursor-pointer text-xs"
                >
                  {tag}
                </Badge>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Topic Hubs */}
      <div>
        <p className="text-sm text-gray-500 mb-2">Topic guides:</p>
        <ul className="space-y-1">
          {topicHubs.slice(0, 3).map(hub => (
            <li key={hub.slug}>
              <Link
                to={`/topics/${hub.slug}`}
                className="text-sm text-gray-400 hover:text-tech-cyan transition-colors"
              >
                {hub.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
};

export default InternalLinks;
