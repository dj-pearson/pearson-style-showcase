import { useEffect, useState } from 'react';

const RobotsTxt = () => {
  const [robotsTxt, setRobotsTxt] = useState<string>('');

  useEffect(() => {
    const generateRobotsTxt = () => {
      const baseUrl = window.location.origin;
      
      const robotsContent = `User-agent: *
Allow: /

# Important files
Sitemap: ${baseUrl}/sitemap.xml

# Block admin areas
Disallow: /admin/
Disallow: /api/

# Allow common crawlers
User-agent: Googlebot
Allow: /

User-agent: Bingbot
Allow: /

# Crawl delay (optional)
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