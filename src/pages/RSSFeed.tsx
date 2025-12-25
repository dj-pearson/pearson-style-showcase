import { useEffect, useState } from 'react';
import { logger } from "@/lib/logger";
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';

type Article = Tables<"articles">;

const BASE_URL = 'https://danpearson.net';

// XML escape special characters
const escapeXml = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

// Strip HTML tags for plain text description
const stripHtml = (html: string): string => {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
};

const RSSFeed = () => {
  const [rssXml, setRssXml] = useState<string>('');

  useEffect(() => {
    const generateRSS = async () => {
      try {
        // Fetch the latest published articles
        const { data: articles, error } = await supabase
          .from('articles')
          .select('slug, title, excerpt, content, category, tags, image_url, created_at, updated_at, author')
          .eq('published', true)
          .order('created_at', { ascending: false })
          .limit(50); // Limit to 50 most recent articles

        if (error) throw error;

        const currentDate = new Date().toUTCString();

        // Generate RSS 2.0 feed
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
     xmlns:content="http://purl.org/rss/1.0/modules/content/"
     xmlns:dc="http://purl.org/dc/elements/1.1/"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Dan Pearson - AI Engineer &amp; Business Development Expert</title>
    <link>${BASE_URL}</link>
    <description>Expert insights on AI engineering, business development, NFT development, and digital innovation. Stay updated with the latest trends and analysis.</description>
    <language>en-us</language>
    <lastBuildDate>${currentDate}</lastBuildDate>
    <pubDate>${currentDate}</pubDate>
    <ttl>60</ttl>
    <atom:link href="${BASE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <image>
      <url>${BASE_URL}/android-chrome-512x512.png</url>
      <title>Dan Pearson</title>
      <link>${BASE_URL}</link>
    </image>
    <copyright>Copyright ${new Date().getFullYear()} Dan Pearson. All rights reserved.</copyright>
    <category>Technology</category>
    <category>Artificial Intelligence</category>
    <category>Business Development</category>
${(articles || []).map((article: Article) => {
  const articleUrl = `${BASE_URL}/news/${article.slug}`;
  const pubDate = article.created_at ? new Date(article.created_at).toUTCString() : currentDate;
  const description = escapeXml(stripHtml(article.excerpt || ''));
  const content = escapeXml(stripHtml(article.content || ''));

  return `    <item>
      <title>${escapeXml(article.title)}</title>
      <link>${articleUrl}</link>
      <guid isPermaLink="true">${articleUrl}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${description}</description>
      <content:encoded><![CDATA[${article.excerpt || ''}]]></content:encoded>
      <dc:creator>${escapeXml(article.author || 'Dan Pearson')}</dc:creator>
      ${article.category ? `<category>${escapeXml(article.category)}</category>` : ''}
      ${(article.tags || []).map((tag: string) => `<category>${escapeXml(tag)}</category>`).join('\n      ')}
      ${article.image_url ? `<media:content url="${escapeXml(article.image_url)}" medium="image">
        <media:title>${escapeXml(article.title)}</media:title>
      </media:content>
      <enclosure url="${escapeXml(article.image_url)}" type="image/jpeg" />` : ''}
    </item>`;
}).join('\n')}
  </channel>
</rss>`;

        setRssXml(xml);
        logger.info(`Generated RSS feed with ${articles?.length || 0} items`);
      } catch (error) {
        logger.error('Error generating RSS feed:', error);
        setRssXml(`<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Dan Pearson - AI Engineer &amp; Business Development Expert</title>
    <link>${BASE_URL}</link>
    <description>Error generating feed</description>
  </channel>
</rss>`);
      }
    };

    generateRSS();
  }, []);

  // Set content type header via useEffect
  useEffect(() => {
    // This component should be served with Content-Type: application/rss+xml
    // In a real deployment, this would be handled by the server
    document.title = 'RSS Feed - Dan Pearson';
  }, []);

  // Return XML content
  return (
    <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
      {rssXml}
    </div>
  );
};

export default RSSFeed;
