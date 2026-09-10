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
    type:
      | 'website'
      | 'article'
      | 'person'
      | 'organization'
      | 'project'
      | 'faq'
      | 'howto'
      | 'product'
      | 'breadcrumb'
      | 'review'
      | 'localbusiness'
      | 'sitenavigation'
      | 'service'
      | 'itemlist';
    data?: Record<string, unknown>;
  };
  // Additional SEO props
  publishedTime?: string;
  modifiedTime?: string;
  section?: string;
  tags?: string[];
  // GEO (Generative Engine Optimization) props
  citationSource?: string;
  contentSummary?: string;
}

// Unlikely to appear inside a tag, so it is safe as a join delimiter.
const TAG_SEPARATOR = '\u0000';

// Every article-scoped meta tag this component owns. Cleared whenever the
// current page is not an article so a stale section or publish date from a
// previously viewed article cannot leak into the next page's markup.
const ARTICLE_META_TAGS = [
  'article:published_time',
  'article:modified_time',
  'article:section',
  'article:author',
  'article:tag',
] as const;

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
  citationSource,
  contentSummary,
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

  // `tags` arrives as a fresh array on almost every render (callers write
  // `tags={article.tags || []}`), which would rerun the whole meta-tag effect
  // each time. Key on the contents instead.
  const tagsKey = useMemo(() => tags.filter(Boolean).join(TAG_SEPARATOR), [tags]);
  const tagList = useMemo(() => (tagsKey ? tagsKey.split(TAG_SEPARATOR) : []), [tagsKey]);

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
      const attribute = isProperty ? 'property' : 'name';

      // An empty value means the tag does not apply to this page. Removing it
      // beats leaving the previous page's value in place.
      if (!content) {
        removeMetaTags(name, isProperty);
        return;
      }

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

    // Helper to remove every meta tag with a given name. Repeatable tags such
    // as article:tag legitimately appear more than once, so this cannot stop
    // at the first match.
    function removeMetaTags(name: string, isProperty = false) {
      const attribute = isProperty ? 'property' : 'name';
      document.querySelectorAll(`meta[${attribute}="${name}"]`).forEach((el) => el.remove());
    }

    // Helper for repeatable tags. Open Graph allows several article:tag
    // entries, one per keyword; writing them through updateMetaTag would
    // overwrite the same element and leave only the last tag.
    const setMetaTagList = (name: string, values: readonly string[], isProperty = false) => {
      removeMetaTags(name, isProperty);
      const attribute = isProperty ? 'property' : 'name';
      values.forEach((value) => {
        if (!value) return;
        const element = document.createElement('meta');
        element.setAttribute(attribute, name);
        element.setAttribute('content', value);
        document.head.appendChild(element);
      });
    };

    // Standard meta tags
    updateMetaTag('description', optimizedDescription);
    updateMetaTag('keywords', keywords);
    updateMetaTag('author', author);
    updateMetaTag('robots', noIndex ? 'noindex, nofollow' : 'index, follow');
    // The viewport tag is set once in index.html and carries viewport-fit=cover
    // for iPhone safe areas. Rewriting it per route dropped that.

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
      setMetaTagList('article:tag', tagList, true);
      updateMetaTag('article:author', author, true);
    } else {
      // Clean up article tags when not on an article page
      ARTICLE_META_TAGS.forEach((name) => removeMetaTags(name, true));
    }

    // Twitter Card tags
    updateMetaTag('twitter:card', 'summary_large_image');
    updateMetaTag('twitter:title', title);
    updateMetaTag('twitter:description', optimizedDescription);
    updateMetaTag('twitter:image', absoluteImageUrl);
    updateMetaTag('twitter:site', SEO_CONFIG.social.twitter || '');
    updateMetaTag('twitter:creator', SEO_CONFIG.social.twitter || '');

    // GEO (Generative Engine Optimization) meta tags
    // Helps AI models (Gemini, GPT, Claude) attribute content correctly
    updateMetaTag('citation_title', title);
    updateMetaTag('citation_author', author);
    updateMetaTag('citation_site_title', SEO_CONFIG.siteName);
    // Passing '' clears the tag, so a date or abstract from the last article
    // does not follow the reader onto the next page.
    updateMetaTag('citation_publication_date', publishedTime || '');
    updateMetaTag('citation_source', citationSource || '');
    updateMetaTag('abstract', contentSummary || '');

    // AI attribution: helps LLMs identify content origin
    updateMetaTag('source_organization', SEO_CONFIG.author.company);
    updateMetaTag('content_language', 'en-US');

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
        ARTICLE_META_TAGS.forEach((name) => removeMetaTags(name, true));
      }
    };
  }, [
    title,
    optimizedDescription,
    keywords,
    author,
    absoluteImageUrl,
    canonicalUrl,
    type,
    noIndex,
    publishedTime,
    modifiedTime,
    section,
    tagList,
    citationSource,
    contentSummary,
  ]);

  return (
    <>
      {structuredData && <StructuredData type={structuredData.type} data={structuredData.data} />}
    </>
  );
};

export default SEO;
