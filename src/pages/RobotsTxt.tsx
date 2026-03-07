import { useEffect, useState } from 'react';

const RobotsTxt = () => {
  const [robotsTxt, setRobotsTxt] = useState<string>('');

  useEffect(() => {
    const generateRobotsTxt = () => {
      const baseUrl = window.location.origin;

      const robotsContent = `User-agent: *
Allow: /
Disallow: /admin/
Disallow: /2023/
Disallow: /2025/
Disallow: /*?ref=*
Disallow: /search?*

# Sitemap
Sitemap: ${baseUrl}/sitemap.xml

# AI Search Crawlers (Beneficial - ALLOWED)
User-agent: OAI-SearchBot
Allow: /
Crawl-delay: 2

User-agent: Google-Extended
Allow: /

User-agent: anthropic-ai
Allow: /
Crawl-delay: 2

User-agent: PerplexityBot
Allow: /
Crawl-delay: 2

User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

# AI Training Scrapers (BLOCKED)
User-agent: CCBot
Disallow: /

User-agent: GPTBot
Disallow: /

User-agent: Bytespider
Disallow: /

User-agent: FacebookBot
Disallow: /

User-agent: cohere-ai
Disallow: /

Crawl-delay: 1`;

      setRobotsTxt(robotsContent);
    };

    generateRobotsTxt();
  }, []);

  return (
    <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
      {robotsTxt}
    </div>
  );
};

export default RobotsTxt;
