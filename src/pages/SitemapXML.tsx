import { useEffect, useState } from 'react';
import { logger } from "@/lib/logger";
import { supabase } from '@/integrations/supabase/client';
import { SEO_CONFIG, escapeXml, generateSlug } from '@/lib/seo';
import { TOPIC_HUBS } from './TopicHub';

interface SitemapUrl {
  loc: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: string;
  images?: Array<{ loc: string; title?: string; caption?: string }>;
}

const BASE_URL = SEO_CONFIG.siteUrl;

const SitemapXML = () => {
  const [sitemapXml, setSitemapXml] = useState<string>('');

  useEffect(() => {
    const generateSitemap = async () => {
      try {
        // Fetch all dynamic content in parallel
        const [articlesRes, projectsRes, aiToolsRes] = await Promise.all([
          supabase
            .from('articles')
            .select('slug, updated_at, created_at, image_url, title, category, tags, featured')
            .eq('published', true)
            .order('updated_at', { ascending: false }),
          supabase
            .from('projects')
            .select('id, updated_at, title, image_url')
            .order('updated_at', { ascending: false }),
          supabase
            .from('ai_tools')
            .select('id, updated_at, title, image_url')
            .order('updated_at', { ascending: false })
        ]);

        const articles = articlesRes.data || [];
        const projects = projectsRes.data || [];
        const aiTools = aiToolsRes.data || [];

        // Extract unique categories and tags from articles
        const categories = Array.from(new Set(
          articles
            .map(a => a.category)
            .filter(Boolean)
        )).sort();

        const tags = Array.from(new Set(
          articles
            .flatMap(a => a.tags || [])
            .filter(Boolean)
        )).sort();

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
          { path: '/topics', priority: '0.8', changefreq: 'weekly' as const },
          { path: '/search', priority: '0.5', changefreq: 'monthly' as const },
        ];

        staticPages.forEach(page => {
          allUrls.push({
            loc: `${BASE_URL}${page.path}`,
            lastmod: page.lastmod || currentDate,
            changefreq: page.changefreq,
            priority: page.priority
          });
        });

        // 1b. Topic Hub pages (programmatic SEO)
        Object.keys(TOPIC_HUBS).forEach(topicSlug => {
          allUrls.push({
            loc: `${BASE_URL}/topics/${topicSlug}`,
            lastmod: currentDate,
            changefreq: 'weekly',
            priority: '0.8'
          });
        });

        // 1c. Author archive pages
        const authors = Array.from(new Set(
          articles
            .map(a => a.author)
            .filter(Boolean)
        ));

        authors.forEach(author => {
          if (!author) return;
          const authorSlug = generateSlug(author);
          const latestByAuthor = articles.find(a => a.author === author);

          allUrls.push({
            loc: `${BASE_URL}/author/${authorSlug}`,
            lastmod: latestByAuthor?.updated_at || currentDate,
            changefreq: 'weekly',
            priority: '0.7'
          });
        });

        // 2. Article category archive pages
        categories.forEach(category => {
          // Get the latest article in this category for lastmod date
          const latestInCategory = articles.find(a => a.category === category);

          allUrls.push({
            loc: `${BASE_URL}/news/category/${category}`,
            lastmod: latestInCategory?.updated_at || currentDate,
            changefreq: 'weekly',
            priority: '0.7'
          });
        });

        // 3. Article tag archive pages
        tags.forEach(tag => {
          // Get the latest article with this tag for lastmod date
          const latestWithTag = articles.find(a => a.tags?.includes(tag));
          const tagSlug = tag.toLowerCase().replace(/\s+/g, '-');

          allUrls.push({
            loc: `${BASE_URL}/news/tag/${tagSlug}`,
            lastmod: latestWithTag?.updated_at || currentDate,
            changefreq: 'weekly',
            priority: '0.6'
          });
        });

        // 4. Individual article pages with images
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

        // 5. Project pages (if individual project pages exist)
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
