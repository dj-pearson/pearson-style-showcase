import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Download, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: string;
}

const SitemapGenerator = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);
  const { toast } = useToast();

  const generateSitemap = async () => {
    setIsGenerating(true);
    try {
      // Get dynamic content
      const { data: articles } = await supabase
        .from('articles')
        .select('slug, updated_at')
        .eq('published', true);

      const { data: projects } = await supabase
        .from('projects')
        .select('id, updated_at');

      const { data: aiTools } = await supabase
        .from('ai_tools')
        .select('id, updated_at');

      const baseUrl = 'https://danpearson.net';
      const currentDate = new Date().toISOString();

      // Static pages
      const staticUrls: SitemapUrl[] = [
        {
          loc: baseUrl,
          lastmod: currentDate,
          changefreq: 'weekly',
          priority: '1.0'
        },
        {
          loc: `${baseUrl}/about`,
          lastmod: currentDate,
          changefreq: 'monthly',
          priority: '0.8'
        },
        {
          loc: `${baseUrl}/projects`,
          lastmod: projects?.[0]?.updated_at || currentDate,
          changefreq: 'weekly',
          priority: '0.9'
        },
        {
          loc: `${baseUrl}/news`,
          lastmod: articles?.[0]?.updated_at || currentDate,
          changefreq: 'weekly',
          priority: '0.9'
        },
        {
          loc: `${baseUrl}/ai-tools`,
          lastmod: aiTools?.[0]?.updated_at || currentDate,
          changefreq: 'weekly',
          priority: '0.8'
        },
        {
          loc: `${baseUrl}/connect`,
          lastmod: currentDate,
          changefreq: 'monthly',
          priority: '0.7'
        }
      ];

      // Dynamic pages
      const dynamicUrls: SitemapUrl[] = [];

      // Add article pages
      articles?.forEach(article => {
        dynamicUrls.push({
          loc: `${baseUrl}/article/${article.slug}`,
          lastmod: article.updated_at,
          changefreq: 'monthly',
          priority: '0.8'
        });
      });

      const allUrls = [...staticUrls, ...dynamicUrls];

      // Generate XML
      const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(url => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

      // Download the sitemap
      const blob = new Blob([sitemapXml], { type: 'application/xml' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sitemap.xml';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      setLastGenerated(new Date().toISOString());
      toast({
        title: "Sitemap Generated",
        description: `Generated sitemap with ${allUrls.length} URLs and downloaded to your computer.`,
      });

    } catch (error) {
      console.error('Error generating sitemap:', error);
      toast({
        title: "Generation Failed",
        description: "Failed to generate sitemap. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Download className="h-5 w-5" />
          XML Sitemap Generator
        </CardTitle>
        <CardDescription>
          Generate an XML sitemap for search engines including all your pages, articles, and projects.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">
              Last generated: {lastGenerated ? new Date(lastGenerated).toLocaleString() : 'Never'}
            </p>
          </div>
          <Button 
            onClick={generateSitemap} 
            disabled={isGenerating}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
            {isGenerating ? 'Generating...' : 'Generate Sitemap'}
          </Button>
        </div>
        
        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>Note:</strong> After generating, upload the sitemap.xml file to your website's root directory and submit it to Google Search Console.</p>
          <p><strong>Includes:</strong> Homepage, About, Projects, News, AI Tools, Connect, and all published articles.</p>
        </div>
      </CardContent>
    </Card>
  );
};

export default SitemapGenerator;