import { Link } from 'react-router-dom';
import Navigation from '../components/Navigation';
import Footer from '../components/Footer';
import SEO from '../components/SEO';
import StructuredData from '../components/SEO/StructuredData';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Layers, Sparkles, TrendingUp, Cpu, RefreshCw, Workflow } from 'lucide-react';
import Breadcrumbs from '@/components/Breadcrumbs';
import { SEO_CONFIG, getCanonicalUrl } from '@/lib/seo';
import { TOPIC_HUBS } from './TopicHub';

// Icon mapping for topics
const TOPIC_ICONS: Record<string, React.ReactNode> = {
  'ai-crm-automation': <Workflow className="w-8 h-8" aria-hidden="true" />,
  'ai-automation': <Cpu className="w-8 h-8" aria-hidden="true" />,
  'business-optimization': <TrendingUp className="w-8 h-8" aria-hidden="true" />,
  'machine-learning': <Sparkles className="w-8 h-8" aria-hidden="true" />,
  'digital-transformation': <RefreshCw className="w-8 h-8" aria-hidden="true" />,
};

const Topics = () => {
  // Breadcrumb items for visual component (label/path format)
  const breadcrumbItems = [{ label: 'Topics', path: '/topics' }];

  // Breadcrumb items for structured data (name/url format)
  const structuredBreadcrumbs = [
    { name: 'Home', url: getCanonicalUrl('/') },
    { name: 'Topics', url: getCanonicalUrl('/topics') },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SEO
        title="Topics - AI & Business Insights Hub | Dan Pearson"
        description="Explore comprehensive guides and resources on AI automation, machine learning, business optimization, and digital transformation. Expert insights organized by topic."
        keywords="AI topics, business automation guides, machine learning resources, digital transformation, technology insights"
        url={getCanonicalUrl('/topics')}
        type="website"
      />

      {/* Breadcrumb Schema */}
      <StructuredData type="breadcrumb" data={{ items: structuredBreadcrumbs }} />

      {/* Website Schema with SearchAction */}
      <StructuredData
        type="website"
        data={{
          name: 'Dan Pearson - Topics Hub',
          description:
            'Explore comprehensive guides and resources on AI automation and business optimization.',
          url: getCanonicalUrl('/topics'),
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

          {/* Header */}
          <header className="mb-12 text-center">
            <Layers className="w-10 h-10 text-tech-cyan mx-auto mb-6" aria-hidden="true" />

            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground mb-4">
              Topics & Resources
            </h1>

            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Deep-dive into comprehensive guides on AI, automation, and business transformation.
              Each topic hub contains curated articles, tutorials, and expert insights.
            </p>
          </header>

          {/* Topic Hubs Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
            {Object.entries(TOPIC_HUBS).map(([slug, config]) => (
              <Link key={slug} to={`/topics/${slug}`} className="group">
                <Card className="h-full p-8 bg-card border-border hover:border-tech-cyan/50 transition-colors">
                  <div className="flex items-start gap-4 mb-4">
                    <div className="text-tech-cyan shrink-0">
                      {TOPIC_ICONS[slug] || <Layers className="w-8 h-8" aria-hidden="true" />}
                    </div>
                    <div className="flex-grow">
                      <h2 className="text-2xl font-bold group-hover:text-tech-cyan transition-colors">
                        {config.title}
                      </h2>
                    </div>
                    <ArrowRight
                      className="w-6 h-6 text-muted-foreground group-hover:text-tech-cyan transition-colors"
                      aria-hidden="true"
                    />
                  </div>

                  <p className="text-muted-foreground mb-6 line-clamp-3">{config.description}</p>

                  <div className="flex flex-wrap gap-2">
                    {config.keywords.slice(0, 4).map((keyword) => (
                      <Badge key={keyword} variant="outline" className="text-xs">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </Card>
              </Link>
            ))}
          </div>

          {/* Quick Links */}
          <section className="py-12 border-t border-border">
            <h2 className="text-2xl font-bold mb-6 text-center">Quick Access</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Link to="/news" className="group">
                <Card className="p-4 text-center bg-card border-border hover:border-tech-cyan/50 transition-colors">
                  <h3 className="font-semibold group-hover:text-tech-cyan transition-colors">
                    All Articles
                  </h3>
                  <p className="text-sm text-muted-foreground">Browse everything</p>
                </Card>
              </Link>
              <Link to="/ai-tools" className="group">
                <Card className="p-4 text-center bg-card border-border hover:border-tech-cyan/50 transition-colors">
                  <h3 className="font-semibold group-hover:text-tech-cyan transition-colors">
                    AI Tools
                  </h3>
                  <p className="text-sm text-muted-foreground">Software & products</p>
                </Card>
              </Link>
              <Link to="/projects" className="group">
                <Card className="p-4 text-center bg-card border-border hover:border-tech-cyan/50 transition-colors">
                  <h3 className="font-semibold group-hover:text-tech-cyan transition-colors">
                    Projects
                  </h3>
                  <p className="text-sm text-muted-foreground">Case studies</p>
                </Card>
              </Link>
              <Link to="/faq" className="group">
                <Card className="p-4 text-center bg-card border-border hover:border-tech-cyan/50 transition-colors">
                  <h3 className="font-semibold group-hover:text-tech-cyan transition-colors">
                    FAQ
                  </h3>
                  <p className="text-sm text-muted-foreground">Common questions</p>
                </Card>
              </Link>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Topics;
