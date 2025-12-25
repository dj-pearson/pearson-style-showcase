import { useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import StructuredData from './SEO/StructuredData';
import { SEO_CONFIG, getCanonicalUrl, truncateDescription } from '@/lib/seo';

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
  // Additional SEO props
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  tags?: string[];
}

const SEO = ({
  title = SEO_CONFIG.defaultTitle,
  description = SEO_CONFIG.defaultDescription,
  keywords = 'AI engineer, AI automation, business development, AI integration, workflow automation, React developer, artificial intelligence',
  author = SEO_CONFIG.author.name,
  image = SEO_CONFIG.defaultImage,
  url,
  type = 'website',
  noIndex = false,
  structuredData,
  publishedTime,
  modifiedTime,
  section,
  tags = [],
}: SEOProps) => {
  const location = useLocation();

  // Memoize computed values for performance
  const canonicalUrl = useMemo(() => {
    return url || getCanonicalUrl(location.pathname);
  }, [url, location.pathname]);

  // Ensure description is within optimal length (50-160 characters)
  const optimizedDescription = useMemo(() => {
    return truncateDescription(description, 160);
  }, [description]);

  // Validate and ensure image URL is absolute
  const absoluteImageUrl = useMemo(() => {
    if (!image) return SEO_CONFIG.defaultImage;
    if (image.startsWith('http')) return image;
    return `${SEO_CONFIG.siteUrl}${image.startsWith('/') ? '' : '/'}${image}`;
  }, [image]);

  useEffect(() => {
    // Update title
    document.title = title;

    // Helper to update or create meta tags
    const updateMetaTag = (name: string, content: string, isProperty = false) => {
      if (!content) return; // Skip empty content

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

    // Helper to remove a meta tag
    const removeMetaTag = (name: string, isProperty = false) => {
      const attribute = isProperty ? 'property' : 'name';
      const element = document.querySelector(`meta[${attribute}="${name}"]`);
      if (element) {
        element.remove();
      }
    };

    // Standard meta tags
    updateMetaTag('description', optimizedDescription);
    updateMetaTag('keywords', keywords);
    updateMetaTag('author', author);
    updateMetaTag('robots', noIndex ? 'noindex, nofollow' : 'index, follow');
    updateMetaTag('viewport', 'width=device-width, initial-scale=1.0');

    // Open Graph tags
    updateMetaTag('og:title', title, true);
    updateMetaTag('og:description', optimizedDescription, true);
    updateMetaTag('og:image', absoluteImageUrl, true);
    updateMetaTag('og:image:width', '1200', true);
    updateMetaTag('og:image:height', '630', true);
    updateMetaTag('og:url', canonicalUrl, true);
    updateMetaTag('og:type', type, true);
    updateMetaTag('og:site_name', SEO_CONFIG.siteName, true);
    updateMetaTag('og:locale', 'en_US', true);

    // Article-specific Open Graph tags
    if (type === 'article') {
      if (publishedTime) {
        updateMetaTag('article:published_time', publishedTime, true);
      }
      if (modifiedTime) {
        updateMetaTag('article:modified_time', modifiedTime, true);
      }
      if (section) {
        updateMetaTag('article:section', section, true);
      }
      tags.forEach((tag, index) => {
        updateMetaTag(`article:tag`, tag, true);
      });
      updateMetaTag('article:author', author, true);
    } else {
      // Clean up article tags when not on an article page
      removeMetaTag('article:published_time', true);
      removeMetaTag('article:modified_time', true);
      removeMetaTag('article:section', true);
      removeMetaTag('article:author', true);
    }

    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', title);
    updateMetaTag('twitter:description', optimizedDescription);
    updateMetaTag('twitter:image', absoluteImageUrl);
    updateMetaTag('twitter:site', SEO_CONFIG.social.twitter || '');
    updateMetaTag('twitter:creator', SEO_CONFIG.social.twitter || '');

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

    // Cleanup function to remove article-specific meta tags when unmounting
    return () => {
      if (type === 'article') {
        removeMetaTag('article:published_time', true);
        removeMetaTag('article:modified_time', true);
        removeMetaTag('article:section', true);
        removeMetaTag('article:author', true);
      }
    };
  }, [title, optimizedDescription, keywords, author, absoluteImageUrl, canonicalUrl, type, noIndex, publishedTime, modifiedTime, section, tags]);

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