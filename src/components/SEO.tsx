import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import StructuredData from './SEO/StructuredData';

const BASE_URL = 'https://danpearson.net';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  author?: string;
  image?: string;
  url?: string; // If not provided, auto-generated from current route
  type?: string;
  noIndex?: boolean; // Set to true for pages that shouldn't be indexed
  structuredData?: {
    type: 'website' | 'article' | 'person' | 'organization' | 'project' | 'faq' | 'howto' | 'product' | 'breadcrumb' | 'review';
    data?: Record<string, unknown>;
  };
}

const SEO = ({
  title = 'Dan Pearson - AI Engineer & Business Development Expert',
  description = 'Experienced AI engineer and business development leader specializing in NFT development, AI integration, and sales leadership. Building innovative solutions for the future.',
  keywords = 'AI engineer, business development, NFT development, AI integration, sales leadership, React developer, blockchain, artificial intelligence',
  author = 'Dan Pearson',
  image = 'https://danpearson.net/android-chrome-512x512.png',
  url,
  type = 'website',
  noIndex = false,
  structuredData
}: SEOProps) => {
  const location = useLocation();
  
  // Auto-generate canonical URL from current route if not provided
  const canonicalUrl = url || `${BASE_URL}${location.pathname === '/' ? '' : location.pathname.replace(/\/$/, '')}`;

  useEffect(() => {
    // Update title
    document.title = title;

    // Update or create meta tags
    const updateMetaTag = (name: string, content: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      let element = document.querySelector(`meta[${attribute}="${name}"]`);
      
      if (element) {
        element.setAttribute('content', content);
      } else {
        element = document.createElement('meta');
        element.setAttribute(attribute, name);
        element.setAttribute('content', content);
        document.head.appendChild(element);
      }
    };

    // Standard meta tags
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords);
    updateMetaTag('author', author);
    updateMetaTag('robots', noIndex ? 'noindex, nofollow' : 'index, follow');
    updateMetaTag('viewport', 'width=device-width, initial-scale=1.0');

    // Open Graph tags
    updateMetaTag('og:title', title, true);
    updateMetaTag('og:description', description, true);
    updateMetaTag('og:image', image, true);
    updateMetaTag('og:url', canonicalUrl, true);
    updateMetaTag('og:type', type, true);
    updateMetaTag('og:site_name', 'Dan Pearson Portfolio', true);

    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', title);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', image);

    // Canonical URL - auto-generated from current route
    let canonicalLink = document.querySelector('link[rel="canonical"]');
    if (canonicalLink) {
      canonicalLink.setAttribute('href', canonicalUrl);
    } else {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      canonicalLink.setAttribute('href', canonicalUrl);
      document.head.appendChild(canonicalLink);
    }
  }, [title, description, keywords, author, image, canonicalUrl, type, noIndex]);

  return (
    <>
      {structuredData && (
        <StructuredData 
          type={structuredData.type} 
          data={structuredData.data} 
        />
      )}
    </>
  );
};

export default SEO;