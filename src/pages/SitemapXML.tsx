import { useEffect, useState } from 'react';
import { logger } from "@/lib/logger";
import { supabase } from '@/integrations/supabase/client';

interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: string;
}

const SitemapXML = () => {
  const [sitemapXml, setSitemapXml] = useState<string>('');

  useEffect(() => {
    const generateSitemap = async () => {
      try {
        // Get dynamic content
        const { data: articles } = await supabase
          .from('articles')
          .select('slug, updated_at, created_at')
          .eq('published', true);

        const { data: projects } = await supabase
          .from('projects')
          .select('id, updated_at');

        const { data: aiTools } = await supabase
          .from('ai_tools')
          .select('id, updated_at');

        const baseUrl = window.location.origin;
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
            loc: `${baseUrl}/news/${article.slug}`,
            lastmod: article.updated_at || article.created_at || new Date().toISOString(),
            changefreq: 'monthly',
            priority: '0.8'
          });
        });

        const allUrls = [...staticUrls, ...dynamicUrls];

        // Generate XML
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(url => `  <url>
    <loc>${url.loc}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

        setSitemapXml(xml);
      } catch (error) {
        logger.error('Error generating sitemap:', error);
        setSitemapXml('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
      }
    };

    generateSitemap();
  }, []);

  // Set content type for XML - handled by browser for this route

  return (
    <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
      {sitemapXml}
    </div>
  );
};

export default SitemapXML;