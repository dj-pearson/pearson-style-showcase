import { useQuery } from '@tanstack/react-query';
import { useParams, Navigate } from 'react-router-dom';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, Eye, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { Link } from 'react-router-dom';

type Article = Tables<"articles">;

const Article = () => {
  const { slug } = useParams<{ slug: string }>();

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
        <Navigation />
        <div className="flex-1 pt-20 px-4 md:px-6">
          <div className="container mx-auto max-w-4xl">
            <div className="animate-pulse space-y-8">
              <div className="h-8 bg-gray-800/50 rounded w-3/4"></div>
              <div className="h-4 bg-gray-800/50 rounded w-1/2"></div>
              <div className="space-y-4">
                <div className="h-4 bg-gray-800/50 rounded"></div>
                <div className="h-4 bg-gray-800/50 rounded"></div>
                <div className="h-4 bg-gray-800/50 rounded w-5/6"></div>
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
        <div className="flex-1 pt-20 px-4 md:px-6">
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

  return (
    <div className="min-h-screen flex flex-col">
      <SEO 
        title={`${article.seo_title || article.title} | Dan Pearson Tech Blog`}
        description={article.seo_description || article.excerpt}
        keywords={article.seo_keywords ? article.seo_keywords.join(', ') : `${article.title}, AI, tech, ${article.category}`}
        url={`https://danpearson.net/article/${article.slug}`}
        type="article"
        image={article.image_url || '/placeholder.svg'}
        structuredData={{
          type: 'article',
          data: {
            headline: article.title,
            description: article.excerpt,
            image: article.image_url || '/placeholder.svg',
            author: {
              '@type': 'Person',
              name: article.author || 'Dan Pearson'
            },
            publisher: {
              '@type': 'Organization',
              name: 'Dan Pearson Tech Blog',
              logo: {
                '@type': 'ImageObject',
                url: '/placeholder.svg'
              }
            },
            datePublished: article.created_at,
            dateModified: article.updated_at,
            mainEntityOfPage: {
              '@type': 'WebPage',
              '@id': `https://danpearson.net/article/${article.slug}`
            }
          }
        }}
      />
      <Navigation />
      <div className="flex-1 pt-20 px-4 md:px-6">
        <div className="container mx-auto max-w-4xl">
          {/* Back Button */}
          <div className="mb-8">
            <Link to="/news">
              <Button variant="ghost" className="text-muted-foreground hover:text-primary">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to News
              </Button>
            </Link>
          </div>

          {/* Article Header */}
          <article className="space-y-8">
            <header className="space-y-6">
              <div className="flex flex-wrap gap-2">
                <Badge className="bg-primary/10 text-primary border-primary/20">
                  {article.category}
                </Badge>
                {article.featured && (
                  <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
                    Featured
                  </Badge>
                )}
              </div>

              <h1 className="text-4xl md:text-5xl font-bold leading-tight">
                {article.title}
              </h1>

              <p className="text-xl text-muted-foreground leading-relaxed">
                {article.excerpt}
              </p>

              <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  {formatDate(article.created_at!)}
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {article.read_time}
                </div>
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  {article.view_count || 0} views
                </div>
                {article.author && (
                  <div>By {article.author}</div>
                )}
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

            {/* Article Content */}
            <div>
              {article.content ? (
                <MarkdownRenderer content={article.content} />
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p>Article content is not available.</p>
                </div>
              )}
            </div>
          </article>

          {/* Article Footer */}
          <div className="mt-16 pt-8 border-t border-border">
            <div className="text-center">
              <Link to="/news">
                <Button size="lg">
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