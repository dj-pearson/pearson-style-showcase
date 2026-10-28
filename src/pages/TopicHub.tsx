import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import NotFound from './NotFound';
import SEO from '../components/SEO';
import StructuredData from '../components/SEO/StructuredData';
import { ArticleCard } from '../components/ArticleCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, BookOpen, TrendingUp, Clock, ArrowRight, Layers } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { mergeStaticArticles, sortArticleListing } from '@/lib/static-articles';
import { Tables } from '@/integrations/supabase/types';
import { ArticleListSkeleton } from '@/components/skeletons';
import Breadcrumbs from '@/components/Breadcrumbs';
import { SEO_CONFIG, getCanonicalUrl, generateSlug } from '@/lib/seo';
import { validateUrlParam } from '@/lib/security';

type Article = Tables<'articles'>;

// Topic hub configurations for pillar content strategy
const TOPIC_HUBS: Record<
  string,
  {
    title: string;
    description: string;
    keywords: string[];
    relatedCategories: string[];
    relatedTags: string[];
    pillarContent?: string; // Slug of main pillar article if exists
  }
> = {
  'ai-crm-automation': {
    title: 'AI CRM Automation',
    description:
      'Research, teardowns and field notes on making the CRM run itself — capture-layer automation, agentic workflows, and why most AI CRM projects fail before they start.',
    keywords: [
      'AI CRM automation',
      'CRM automation',
      'sales automation',
      'agentic CRM',
      'CRM data quality',
      'RevOps',
    ],
    relatedCategories: ['CRM', 'Sales', 'AI'],
    relatedTags: [
      'CRM',
      'CRM Automation',
      'Sales Automation',
      'HubSpot',
      'Salesforce',
      'Pipeline',
      'RevOps',
      'AI Agents',
    ],
    pillarContent: 'ai-crm-automation-complete-guide',
  },
  'ai-automation': {
    title: 'AI Automation',
    description:
      'Complete guide to AI automation for business. Learn how to implement AI-powered workflows, reduce manual tasks, and transform your operations.',
    keywords: [
      'AI automation',
      'business automation',
      'workflow automation',
      'AI tools',
      'automation strategy',
    ],
    relatedCategories: ['AI', 'Technology', 'Business'],
    relatedTags: ['AI', 'Automation', 'Machine Learning', 'Workflow', 'Productivity'],
  },
  'business-optimization': {
    title: 'Business Optimization',
    description:
      'Strategies and insights for optimizing business operations, improving efficiency, and driving growth through technology and AI.',
    keywords: [
      'business optimization',
      'process improvement',
      'efficiency',
      'growth strategies',
      'business transformation',
    ],
    relatedCategories: ['Business', 'Strategy', 'Management'],
    relatedTags: ['Optimization', 'Efficiency', 'Growth', 'Strategy', 'ROI'],
  },
  'machine-learning': {
    title: 'Machine Learning',
    description:
      'Explore machine learning concepts, applications, and implementation strategies for business. From basics to advanced use cases.',
    keywords: ['machine learning', 'ML', 'AI', 'predictive analytics', 'data science'],
    relatedCategories: ['AI', 'Technology', 'Data'],
    relatedTags: [
      'Machine Learning',
      'AI',
      'Data Science',
      'Predictive Analytics',
      'Neural Networks',
    ],
  },
  'digital-transformation': {
    title: 'Digital Transformation',
    description:
      'Navigate your digital transformation journey with insights on technology adoption, change management, and modernizing business processes.',
    keywords: [
      'digital transformation',
      'modernization',
      'technology adoption',
      'change management',
      'digital strategy',
    ],
    relatedCategories: ['Technology', 'Business', 'Strategy'],
    relatedTags: ['Digital Transformation', 'Modernization', 'Cloud', 'Innovation'],
  },
};

const TopicHub = () => {
  const { topic: rawTopic } = useParams<{ topic: string }>();
  // Hub keys are lowercase slugs, so /topics/AI-Automation resolves to the
  // same hub (and canonical) as /topics/ai-automation.
  const validTopic = rawTopic ? validateUrlParam(rawTopic) : null;
  const topic = validTopic ? validTopic.toLowerCase() : null;

  // Get topic configuration
  const topicConfig = topic ? TOPIC_HUBS[topic] : null;

  const {
    data: articles,
    isLoading,
    error,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ['articles', 'topic-hub', topic],
    queryFn: async () => {
      if (!topic || !topicConfig) throw new Error('Invalid topic');

      // Search for articles matching topic categories or tags
      const { data, error } = await supabase
        .from('articles')
        .select(
          'id, slug, title, excerpt, category, tags, image_url, created_at, read_time, view_count, featured, author'
        )
        .eq('published', true)
        .order('featured', { ascending: false })
        .order('view_count', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Include articles that are built into the site but have no database row
      // yet, so the hub is not empty for content whose pages already render
      // (US-074/US-082). A database row wins on a slug collision.
      const merged = sortArticleListing(mergeStaticArticles(data));

      // Filter articles that match topic's categories or tags
      const relevantArticles = merged.filter((article) => {
        const matchesCategory = topicConfig.relatedCategories.some(
          (cat) => article.category?.toLowerCase() === cat.toLowerCase()
        );
        const matchesTags = topicConfig.relatedTags.some((tag) =>
          article.tags?.some((t: string) => t.toLowerCase() === tag.toLowerCase())
        );
        return matchesCategory || matchesTags;
      });

      return relevantArticles as Article[];
    },
    enabled: !!topic && !!topicConfig,
  });

  // An unknown topic is a 404, not a redirect: redirecting to /news told
  // crawlers every made-up /topics/* URL was a soft duplicate of the listing.
  if (!topic || !topicConfig) {
    return <NotFound />;
  }

  // Group articles by type
  const featuredArticles = articles?.filter((a) => a.featured) || [];
  const recentArticles = articles?.filter((a) => !a.featured).slice(0, 6) || [];
  const popularArticles = [...(articles || [])]
    .sort((a, b) => (b.view_count || 0) - (a.view_count || 0))
    .slice(0, 3);

  // Get unique subtopics (tags) from articles
  const subtopics = articles
    ? Array.from(new Set(articles.flatMap((a) => a.tags || []))).slice(0, 12)
    : [];

  // Get unique categories
  const categories = articles
    ? Array.from(new Set(articles.map((a) => a.category).filter(Boolean)))
    : [];

  // Breadcrumb items for visual component (label/path format)
  const breadcrumbItems = [
    { label: 'Topics', path: '/topics' },
    { label: topicConfig.title, path: `/topics/${topic}` },
  ];

  // Breadcrumb items for structured data (name/url format)
  const structuredBreadcrumbs = [
    { name: 'Home', url: getCanonicalUrl('/') },
    { name: 'Topics', url: getCanonicalUrl('/topics') },
    { name: topicConfig.title, url: getCanonicalUrl(`/topics/${topic}`) },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SEO
        title={`${topicConfig.title} - Complete Guide & Resources | Dan Pearson`}
        description={topicConfig.description}
        keywords={topicConfig.keywords.join(', ')}
        url={getCanonicalUrl(`/topics/${topic}`)}
        type="website"
      />

      {/* Breadcrumb Schema */}
      <StructuredData type="breadcrumb" data={{ items: structuredBreadcrumbs }} />

      {/* CollectionPage Schema for topic hub */}
      <StructuredData
        type="website"
        data={{
          name: `${topicConfig.title} - Topic Hub`,
          description: topicConfig.description,
          url: getCanonicalUrl(`/topics/${topic}`),
          keywords: topicConfig.keywords,
          author: {
            '@type': 'Person',
            name: SEO_CONFIG.author.name,
            url: SEO_CONFIG.author.url,
          },
        }}
      />

      <Navigation />

      <main id="main-content" className="flex-1 pt-20 px-4 md:px-6 pb-16">
        <div className="container mx-auto max-w-7xl">
          {/* Breadcrumbs */}
          <Breadcrumbs items={breadcrumbItems} className="mb-6" />

          {/* Topic Hub Header */}
          <header className="mb-12">
            <div className="flex items-center gap-3 mb-4">
              <Layers className="w-8 h-8 text-tech-cyan" aria-hidden="true" />
              <Badge variant="secondary" className="text-xs uppercase tracking-wider">
                Topic Hub
              </Badge>
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
              {topicConfig.title}
            </h1>

            <p className="text-xl text-muted-foreground max-w-3xl mb-6">
              {topicConfig.description}
            </p>

            {/* Topic Stats */}
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground mb-6">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4" aria-hidden="true" />
                <span>{articles?.length || 0} Articles</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" aria-hidden="true" />
                <span>{categories.length} Categories</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4" aria-hidden="true" />
                <span>Updated regularly</span>
              </div>
            </div>

            {/* Related Categories */}
            {categories.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-sm text-muted-foreground">Categories:</span>
                {categories.map((category) => (
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

            {/* Subtopics / Tags */}
            {subtopics.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-muted-foreground">Explore:</span>
                {subtopics.map((tag) => (
                  <Link key={tag} to={`/news/tag/${generateSlug(tag)}`}>
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
          </header>

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

          {/* Content Sections */}
          {!isLoading && !error && articles && articles.length > 0 && (
            <div className="space-y-16">
              {/* Featured/Pillar Content */}
              {featuredArticles.length > 0 && (
                <section>
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <span className="text-tech-cyan">Essential Reading</span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {featuredArticles.slice(0, 2).map((article) => (
                      <ArticleCard key={article.id} article={article} />
                    ))}
                  </div>
                </section>
              )}

              {/* Popular Articles */}
              {popularArticles.length > 0 && (
                <section>
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-tech-cyan" aria-hidden="true" />
                    Most Popular
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {popularArticles.map((article, index) => (
                      <Card
                        key={article.id}
                        className="bg-card border-border hover:border-tech-cyan/50 transition-colors"
                      >
                        <Link to={`/news/${article.slug}`} className="block p-4">
                          <div className="flex items-start gap-4">
                            <span className="text-3xl font-bold text-tech-cyan/30">
                              {index + 1}
                            </span>
                            <div>
                              <h3 className="font-semibold line-clamp-2 hover:text-tech-cyan transition-colors">
                                {article.title}
                              </h3>
                              <p className="text-sm text-muted-foreground mt-1">
                                {article.view_count || 0} views
                              </p>
                            </div>
                          </div>
                        </Link>
                      </Card>
                    ))}
                  </div>
                </section>
              )}

              {/* Recent Articles */}
              {recentArticles.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold flex items-center gap-2">
                      <Clock className="w-5 h-5 text-tech-cyan" aria-hidden="true" />
                      Recent Articles
                    </h2>
                    <Link
                      to="/news"
                      className="text-tech-cyan hover:underline flex items-center gap-1"
                    >
                      View all <ArrowRight className="w-4 h-4" aria-hidden="true" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {recentArticles.map((article) => (
                      <ArticleCard key={article.id} article={article} />
                    ))}
                  </div>
                </section>
              )}

              {/* All Articles */}
              {articles.length > 8 && (
                <section>
                  <h2 className="text-2xl font-bold mb-6">All {topicConfig.title} Articles</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {articles.slice(8).map((article) => (
                      <ArticleCard key={article.id} article={article} />
                    ))}
                  </div>
                </section>
              )}

              {/* Related Topic Hubs */}
              <section className="pt-8 border-t border-border">
                <h2 className="text-2xl font-bold mb-6">Explore More Topics</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  {Object.entries(TOPIC_HUBS)
                    .filter(([key]) => key !== topic)
                    .map(([key, config]) => (
                      <Link key={key} to={`/topics/${key}`}>
                        <Card className="p-4 bg-card border-border hover:border-tech-cyan/50 transition-colors h-full">
                          <h3 className="font-semibold mb-2">{config.title}</h3>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {config.description.slice(0, 80)}...
                          </p>
                        </Card>
                      </Link>
                    ))}
                </div>
              </section>
            </div>
          )}

          {/* No Articles Found */}
          {!isLoading && !error && articles?.length === 0 && (
            <div className="text-center py-12">
              <BookOpen
                className="w-16 h-16 text-muted-foreground mx-auto mb-4"
                aria-hidden="true"
              />
              <h2 className="text-2xl font-semibold mb-2">No articles found</h2>
              <p className="text-muted-foreground mb-6">
                We're building content for this topic. Check back soon!
              </p>
              <Button asChild>
                <Link to="/news">Browse All Articles</Link>
              </Button>
            </div>
          )}

          {/* Back Navigation */}
          <div className="mt-12 pt-8 border-t border-border">
            <Button variant="outline" className="gap-2" asChild>
              <Link to="/news">
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                Back to All Articles
              </Link>
            </Button>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

// Export topic hub configurations for sitemap generation
export { TOPIC_HUBS };
export default TopicHub;
