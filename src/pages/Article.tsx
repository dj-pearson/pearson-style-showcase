import { useQuery } from '@tanstack/react-query';
import { useParams, Navigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { ReadingProgress } from '../components/ReadingProgress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Eye, ArrowLeft, Share2, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Link } from 'react-router-dom';
import { useAffiliateTracking } from '@/hooks/useAffiliateTracking';
import { useToast } from '@/hooks/use-toast';
import AuthorByline from '../components/article/AuthorByline';
import Breadcrumbs from '../components/Breadcrumbs';
import StructuredData from '../components/SEO/StructuredData';
import RelatedArticles from '../components/article/RelatedArticles';
import KeyTakeaways, { extractKeyTakeaways } from '../components/article/KeyTakeaways';

type Article = Tables<"articles">;

const Article = () => {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();

  const { data: article, isLoading, error } = useQuery({
    queryKey: ['article', slug],
    queryFn: async () => {
      if (!slug) throw new Error('No slug provided');

      const { data, error } = await supabase
        .from('articles')
        .select('*')
        .eq('slug', slug)
        .eq('published', true)
        .maybeSingle();

      if (error) throw error;
      return data as Article | null;
    },
    enabled: !!slug,
  });

  // Extract key takeaways for AI search optimization
  const keyTakeaways = article?.content ? extractKeyTakeaways(article.content) : [];

  // Track affiliate link clicks
  useAffiliateTracking(article?.id || '');

  const handleShare = async (platform: string) => {
    const url = window.location.href;
    const title = article?.title || '';

    switch (platform) {
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'linkedin':
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`, '_blank');
        break;
      case 'copy':
        await navigator.clipboard.writeText(url);
        toast({
          title: "Link copied!",
          description: "Article link copied to clipboard",
        });
        break;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (!slug) {
    return <Navigate to="/news" replace />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        {/* SEO fallback during loading - ensures crawlers see valid meta tags */}
        <SEO
          title={`Article | Dan Pearson`}
          description="Read the latest insights on AI automation, business development, and technology from Dan Pearson."
          keywords="AI automation, business automation, technology insights, Dan Pearson"
          url={`https://danpearson.net/news/${slug}`}
          type="article"
        />
        <Navigation />
        <div id="main-content" className="flex-1 pt-20 px-4 md:px-6" role="status" aria-label="Loading article">
          <div className="container mx-auto max-w-4xl">
            <div className="animate-pulse space-y-8">
              {/* Breadcrumb skeleton */}
              <div className="flex gap-2 items-center">
                <div className="h-4 bg-gray-800/50 rounded w-12"></div>
                <div className="h-4 bg-gray-800/50 rounded w-4"></div>
                <div className="h-4 bg-gray-800/50 rounded w-16"></div>
              </div>
              {/* Category badge */}
              <div className="h-6 bg-gray-800/50 rounded w-24"></div>
              {/* Title */}
              <div className="h-10 bg-gray-800/50 rounded w-3/4"></div>
              {/* Excerpt */}
              <div className="h-6 bg-gray-800/50 rounded w-2/3"></div>
              {/* Meta info */}
              <div className="flex gap-6">
                <div className="h-4 bg-gray-800/50 rounded w-32"></div>
                <div className="h-4 bg-gray-800/50 rounded w-24"></div>
                <div className="h-4 bg-gray-800/50 rounded w-20"></div>
              </div>
              {/* Tags */}
              <div className="flex gap-2">
                <div className="h-6 bg-gray-800/50 rounded w-16"></div>
                <div className="h-6 bg-gray-800/50 rounded w-20"></div>
                <div className="h-6 bg-gray-800/50 rounded w-14"></div>
              </div>
              {/* Image placeholder */}
              <div className="h-64 bg-gray-800/50 rounded"></div>
              {/* Content paragraphs */}
              <div className="space-y-4">
                <div className="h-4 bg-gray-800/50 rounded"></div>
                <div className="h-4 bg-gray-800/50 rounded"></div>
                <div className="h-4 bg-gray-800/50 rounded w-5/6"></div>
                <div className="h-4 bg-gray-800/50 rounded"></div>
                <div className="h-4 bg-gray-800/50 rounded w-4/5"></div>
              </div>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <div id="main-content" className="flex-1 pt-20 px-4 md:px-6">
          <div className="container mx-auto max-w-4xl">
            <div className="text-center py-16">
              <h1 className="text-2xl font-bold mb-4">Article Not Found</h1>
              <p className="text-muted-foreground mb-8">
                The article you're looking for doesn't exist or has been removed.
              </p>
              <Link to="/news">
                <Button>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to News
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  const breadcrumbItems = [
    { label: 'Home', path: '/' },
    { label: 'News', path: '/news' },
    { label: article.title, path: `/news/${article.slug}` }
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <ReadingProgress />
      <SEO
        title={`${article.seo_title || article.title} | Dan Pearson`}
        description={article.seo_description || article.excerpt}
        keywords={article.seo_keywords ? article.seo_keywords.join(', ') : `${article.title}, AI automation, business automation, ${article.category}`}
        url={`https://danpearson.net/news/${article.slug}`}
        type="article"
        image={(article.social_image_url && article.social_image_url.startsWith('http') ? article.social_image_url : article.social_image_url ? `https://danpearson.net${article.social_image_url}` : (article.image_url && article.image_url.startsWith('http') ? article.image_url : article.image_url ? `https://danpearson.net${article.image_url}` : 'https://danpearson.net/placeholder.svg'))}
      />

      {/* Enhanced Article Schema with Author Authority & AI Search Optimization */}
      <StructuredData
        type="article"
        data={{
          headline: article.title,
          description: article.excerpt,
          image: (article.social_image_url && article.social_image_url.startsWith('http') ? article.social_image_url : article.social_image_url ? `https://danpearson.net${article.social_image_url}` : (article.image_url && article.image_url.startsWith('http') ? article.image_url : article.image_url ? `https://danpearson.net${article.image_url}` : 'https://danpearson.net/placeholder.svg')),
          author: {
            '@type': 'Person',
            name: article.author || 'Dan Pearson',
            url: 'https://danpearson.net/about',
            jobTitle: 'AI Solutions Consultant',
            worksFor: {
              '@type': 'Organization',
              name: 'Pearson Media LLC'
            },
            sameAs: [
              'https://linkedin.com/in/danpearson',
              'https://github.com/dj-pearson'
            ]
          },
          publisher: {
            '@type': 'Person',
            name: 'Dan Pearson',
            url: 'https://danpearson.net',
            logo: {
              '@type': 'ImageObject',
              url: 'https://danpearson.net/placeholder.svg'
            }
          },
          datePublished: article.created_at,
          dateModified: article.updated_at || article.created_at,
          mainEntityOfPage: {
            '@type': 'WebPage',
            '@id': `https://danpearson.net/news/${article.slug}`
          },
          keywords: (article.tags || []).join(', '),
          articleSection: article.category,
          wordCount: article.content?.length || 0,
          slug: article.slug,

          // AI Search Optimization: Entity linking
          // Use tags as "about" topics and category as primary topic
          about: [article.category, ...(article.tags || [])].filter(Boolean),

          // Mentions: Extract key entities (tags serve as entity mentions)
          mentions: article.tags || [],

          // Speakable: CSS selectors for content suitable for voice search
          speakable: ['#key-takeaways-heading', '[itemprop="headline"]', '[itemprop="description"]'],

          // Abstract: Key takeaways summary for AI engines
          abstract: keyTakeaways.length > 0
            ? `Key points: ${keyTakeaways.slice(0, 3).join('. ')}`
            : article.excerpt
        }}
      />

      {/* Breadcrumb Schema */}
      <StructuredData
        type="breadcrumb"
        data={{
          items: breadcrumbItems.map((item, index) => ({
            name: item.label,
            url: `https://danpearson.net${item.path}`
          }))
        }}
      />

      <Navigation />
      <div id="main-content" className="flex-1 pt-20 px-4 md:px-6">
        <div className="container mx-auto max-w-4xl">
          {/* Breadcrumbs */}
          <div className="mb-6">
            <Breadcrumbs items={breadcrumbItems} />
          </div>

          {/* Semantic Article Structure */}
          <article className="space-y-8" itemScope itemType="https://schema.org/Article">
            <header className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-primary/10 text-primary border-primary/20" itemProp="articleSection">
                  {article.category}
                </Badge>
                {article.featured && (
                  <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                    Featured
                  </Badge>
                )}
              </div>

              <h1 className="text-4xl md:text-5xl font-bold leading-tight" itemProp="headline">
                {article.title}
              </h1>

              <p className="text-xl text-muted-foreground leading-relaxed" itemProp="description">
                {article.excerpt}
              </p>

              <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <time itemProp="datePublished" dateTime={article.created_at!}>
                    {formatDate(article.created_at!)}
                  </time>
                </div>
                {article.updated_at && article.updated_at !== article.created_at && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs">Updated:</span>
                    <time itemProp="dateModified" dateTime={article.updated_at}>
                      {formatDate(article.updated_at)}
                    </time>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  <span>{article.read_time}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  <span>{article.view_count || 0} views</span>
                </div>
                <div itemProp="author" itemScope itemType="https://schema.org/Person">
                  <span>By <span itemProp="name">{article.author || 'Dan Pearson'}</span></span>
                </div>
              </div>

              {article.tags && article.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {article.tags.map((tag, index) => (
                    <Badge 
                      key={index} 
                      variant="outline" 
                      className="border-border/50 text-muted-foreground hover:border-primary/50"
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </header>

            {/* Article Image */}
            {article.image_url && (
              <div className="relative aspect-video rounded-lg overflow-hidden bg-muted">
                <img
                  src={article.image_url}
                  alt={article.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            {/* Key Takeaways - AI Search Optimization */}
            {keyTakeaways.length > 0 && (
              <KeyTakeaways
                takeaways={keyTakeaways}
                articleTitle={article.title}
              />
            )}

            {/* Article Content */}
            <div className="prose prose-invert max-w-none" itemProp="articleBody">
              {article.content ? (
                <>
                  <MarkdownRenderer content={article.content} />

                  {/* Affiliate Disclosure */}
                  {article.content.includes('amazon.com') && (
                    <div className="mt-8 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                      <div className="flex items-start gap-3">
                        <ExternalLink className="w-5 h-5 text-cyan-400 mt-0.5 flex-shrink-0" />
                        <div className="text-sm text-gray-300">
                          <strong className="text-cyan-400">Affiliate Disclosure:</strong> This article contains Amazon affiliate links.
                          As an Amazon Associate, I earn from qualifying purchases at no extra cost to you.
                        </div>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Article content is not available.</p>
                </div>
              )}
            </div>

            {/* Author Byline - E-E-A-T Signal */}
            <div className="mt-12 pt-8 border-t border-border">
              <AuthorByline authorName={article.author || 'Dan Pearson'} />
            </div>

            {/* Share Section */}
            <div className="mt-12 pt-8 border-t border-border">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <p className="text-lg font-semibold text-gray-300">Share this article</p>
                <div className="flex flex-wrap gap-3 justify-center">
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => handleShare('twitter')}
                    className="mobile-button border-gray-600 hover:border-cyan-500"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Twitter
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => handleShare('linkedin')}
                    className="mobile-button border-gray-600 hover:border-cyan-500"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    LinkedIn
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => handleShare('facebook')}
                    className="mobile-button border-gray-600 hover:border-cyan-500"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Facebook
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => handleShare('copy')}
                    className="mobile-button border-gray-600 hover:border-cyan-500"
                  >
                    <Share2 className="w-4 h-4 mr-2" />
                    Copy Link
                  </Button>
                </div>
              </div>
            </div>
          </article>

          {/* Related Articles - Smart Tag-Based Matching for Internal Linking SEO */}
          <RelatedArticles
            currentArticleId={article.id}
            category={article.category}
            tags={article.tags || []}
            maxArticles={3}
          />

          {/* Article Footer */}
          <div className="mt-16 pt-8 border-t border-border">
            <div className="text-center">
              <Link to="/news">
                <Button size="lg" className="mobile-button">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to All Articles
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default Article;