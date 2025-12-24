import { useEffect, useState } from 'react';
import { logger } from "@/lib/logger";
import { supabase } from '@/integrations/supabase/client';

interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: string;
  images?: Array<{ loc: string; title?: string; caption?: string }>;
}

const BASE_URL = 'https://danpearson.net';

// XML escape special characters
const escapeXml = (str: string): string => {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const SitemapXML = () => {
  const [sitemapXml, setSitemapXml] = useState<string>('');

  useEffect(() => {
    const generateSitemap = async () => {
      try {
        // Fetch all dynamic content in parallel
        const [articlesRes, projectsRes, aiToolsRes, categoriesRes] = await Promise.all([
          supabase
            .from('articles')
            .select('slug, updated_at, created_at, image_url, title, category, featured')
            .eq('published', true)
            .order('updated_at', { ascending: false }),
          supabase
            .from('projects')
            .select('id, updated_at, title, image_url')
            .order('updated_at', { ascending: false }),
          supabase
            .from('ai_tools')
            .select('id, updated_at, title, image_url')
            .order('updated_at', { ascending: false }),
          supabase
            .from('article_categories')
            .select('slug, name')
        ]);

        const articles = articlesRes.data || [];
        const projects = projectsRes.data || [];
        const aiTools = aiToolsRes.data || [];
        const categories = categoriesRes.data || [];

        const currentDate = new Date().toISOString();
        const allUrls: SitemapUrl[] = [];

        // 1. Static pages with appropriate priorities
        const staticPages = [
          { path: '', priority: '1.0', changefreq: 'weekly' as const },
          { path: '/about', priority: '0.8', changefreq: 'monthly' as const },
          { path: '/projects', priority: '0.9', changefreq: 'weekly' as const, lastmod: projects[0]?.updated_at },
          { path: '/news', priority: '0.9', changefreq: 'daily' as const, lastmod: articles[0]?.updated_at },
          { path: '/ai-tools', priority: '0.8', changefreq: 'weekly' as const, lastmod: aiTools[0]?.updated_at },
          { path: '/connect', priority: '0.7', changefreq: 'monthly' as const },
          { path: '/faq', priority: '0.8', changefreq: 'weekly' as const },
        ];

        staticPages.forEach(page => {
          allUrls.push({
            loc: `${BASE_URL}${page.path}`,
            lastmod: page.lastmod || currentDate,
            changefreq: page.changefreq,
            priority: page.priority
          });
        });

        // 2. Article category pages (if they exist)
        categories.forEach(category => {
          allUrls.push({
            loc: `${BASE_URL}/news?category=${category.slug}`,
            lastmod: currentDate,
            changefreq: 'weekly',
            priority: '0.7'
          });
        });

        // 3. Individual article pages with images
        articles.forEach(article => {
          const url: SitemapUrl = {
            loc: `${BASE_URL}/news/${article.slug}`,
            lastmod: article.updated_at || article.created_at || currentDate,
            changefreq: 'monthly',
            // Featured articles get higher priority
            priority: article.featured ? '0.9' : '0.8'
          };

          // Add image if available
          if (article.image_url) {
            url.images = [{
              loc: article.image_url,
              title: escapeXml(article.title || ''),
              caption: escapeXml(`${article.title || ''} - ${article.category || 'Article'}`)
            }];
          }

          allUrls.push(url);
        });

        // 4. Project pages (if individual project pages exist)
        // Note: Currently projects are on a single page, but prepared for future expansion
        projects.forEach(project => {
          if (project.image_url) {
            // Add project images to the projects listing page
            const existingProjectsUrl = allUrls.find(u => u.loc === `${BASE_URL}/projects`);
            if (existingProjectsUrl) {
              if (!existingProjectsUrl.images) {
                existingProjectsUrl.images = [];
              }
              existingProjectsUrl.images.push({
                loc: project.image_url,
                title: escapeXml(project.title || '')
              });
            }
          }
        });

        // Generate XML with image sitemap namespace
        const hasImages = allUrls.some(u => u.images && u.images.length > 0);
        const namespaces = hasImages 
          ? 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"'
          : 'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"';

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset ${namespaces}>
${allUrls.map(url => {
  let urlXml = `  <url>
    <loc>${escapeXml(url.loc)}</loc>
    <lastmod>${url.lastmod}</lastmod>
    <changefreq>${url.changefreq}</changefreq>
    <priority>${url.priority}</priority>`;
  
  // Add image tags if present
  if (url.images && url.images.length > 0) {
    url.images.forEach(img => {
      urlXml += `
    <image:image>
      <image:loc>${escapeXml(img.loc)}</image:loc>${img.title ? `
      <image:title>${img.title}</image:title>` : ''}${img.caption ? `
      <image:caption>${img.caption}</image:caption>` : ''}
    </image:image>`;
    });
  }
  
  urlXml += `
  </url>`;
  return urlXml;
}).join('\n')}
</urlset>`;

        setSitemapXml(xml);
        logger.info(`Generated sitemap with ${allUrls.length} URLs`);
      } catch (error) {
        logger.error('Error generating sitemap:', error);
        setSitemapXml('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>');
      }
    };

    generateSitemap();
  }, []);

  // Return XML content
  return (
    <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
      {sitemapXml}
    </div>
  );
};

export default SitemapXML;
