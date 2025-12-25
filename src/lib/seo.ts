/**
 * Centralized SEO utilities and constants
 * Provides consistent SEO configuration across the application
 */

export const SEO_CONFIG = {
  siteName: 'Dan Pearson',
  siteUrl: 'https://danpearson.net',
  defaultTitle: 'Dan Pearson - AI Engineer & Business Development Expert',
  defaultDescription: 'Experienced AI engineer and business development leader specializing in AI automation, workflow optimization, and sales leadership. Building innovative solutions for the future.',
  defaultImage: 'https://danpearson.net/android-chrome-512x512.png',
  author: {
    name: 'Dan Pearson',
    jobTitle: 'AI Solutions Consultant',
    company: 'Pearson Media LLC',
    url: 'https://danpearson.net/about',
    linkedin: 'https://linkedin.com/in/danpearson',
    github: 'https://github.com/dj-pearson',
  },
  social: {
    twitter: '@danpearson',
    linkedin: 'https://linkedin.com/in/danpearson',
    github: 'https://github.com/dj-pearson',
  },
} as const;

/**
 * Priority levels for sitemap entries
 */
export const SITEMAP_PRIORITY = {
  homepage: '1.0',
  mainPages: '0.9',
  archives: '0.7',
  articles: '0.8',
  featuredArticles: '0.9',
  tags: '0.6',
} as const;

/**
 * Change frequency values for sitemap
 */
export const CHANGE_FREQ = {
  always: 'always',
  hourly: 'hourly',
  daily: 'daily',
  weekly: 'weekly',
  monthly: 'monthly',
  yearly: 'yearly',
  never: 'never',
} as const;

/**
 * Generates a canonical URL from a path
 */
export function getCanonicalUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  const normalizedPath = cleanPath === '/' ? '' : cleanPath.replace(/\/$/, '');
  return `${SEO_CONFIG.siteUrl}${normalizedPath}`;
}

/**
 * Generates page title with site name suffix
 */
export function getPageTitle(title: string, includeSiteName = true): string {
  if (!title) return SEO_CONFIG.defaultTitle;
  return includeSiteName ? `${title} | ${SEO_CONFIG.siteName}` : title;
}

/**
 * Generates SEO-friendly slug from text
 */
export function generateSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Truncates description to optimal length for SEO
 */
export function truncateDescription(text: string, maxLength = 160): string {
  if (!text || text.length <= maxLength) return text || '';

  const truncated = text.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  return lastSpace > maxLength * 0.8
    ? truncated.slice(0, lastSpace) + '...'
    : truncated + '...';
}

/**
 * Generates keywords from tags and category
 */
export function generateKeywords(
  tags: string[] = [],
  category?: string,
  additionalKeywords: string[] = []
): string {
  const allKeywords = [
    ...tags,
    category,
    ...additionalKeywords,
    'AI automation',
    'business automation',
    SEO_CONFIG.author.name,
  ].filter(Boolean) as string[];

  // Remove duplicates and join
  return [...new Set(allKeywords)].join(', ');
}

/**
 * Format date for schema.org
 */
export function formatSchemaDate(date: string | Date): string {
  return new Date(date).toISOString();
}

/**
 * Generates breadcrumb items for structured data
 */
export interface BreadcrumbItem {
  name: string;
  url: string;
}

export function generateBreadcrumbs(items: Array<{ label: string; path: string }>): BreadcrumbItem[] {
  return items.map(item => ({
    name: item.label,
    url: getCanonicalUrl(item.path),
  }));
}

/**
 * Article SEO data interface
 */
export interface ArticleSeoData {
  title: string;
  description: string;
  keywords: string;
  image: string;
  url: string;
  publishedDate: string;
  modifiedDate?: string;
  author: string;
  category: string;
  tags: string[];
}

/**
 * Generates complete article SEO data
 */
export function getArticleSeoData(article: {
  title: string;
  slug: string;
  excerpt?: string;
  seo_title?: string;
  seo_description?: string;
  seo_keywords?: string[];
  image_url?: string;
  social_image_url?: string;
  created_at?: string;
  updated_at?: string;
  author?: string;
  category: string;
  tags?: string[];
}): ArticleSeoData {
  const imageUrl = article.social_image_url || article.image_url;
  const fullImageUrl = imageUrl?.startsWith('http')
    ? imageUrl
    : imageUrl
      ? `${SEO_CONFIG.siteUrl}${imageUrl}`
      : SEO_CONFIG.defaultImage;

  return {
    title: getPageTitle(article.seo_title || article.title),
    description: truncateDescription(article.seo_description || article.excerpt || ''),
    keywords: generateKeywords(
      article.tags || [],
      article.category,
      article.seo_keywords
    ),
    image: fullImageUrl,
    url: getCanonicalUrl(`/news/${article.slug}`),
    publishedDate: article.created_at || new Date().toISOString(),
    modifiedDate: article.updated_at,
    author: article.author || SEO_CONFIG.author.name,
    category: article.category,
    tags: article.tags || [],
  };
}

/**
 * Generates author schema data
 */
export function getAuthorSchema() {
  return {
    '@type': 'Person',
    name: SEO_CONFIG.author.name,
    url: SEO_CONFIG.author.url,
    jobTitle: SEO_CONFIG.author.jobTitle,
    worksFor: {
      '@type': 'Organization',
      name: SEO_CONFIG.author.company,
    },
    sameAs: [
      SEO_CONFIG.author.linkedin,
      SEO_CONFIG.author.github,
    ],
  };
}

/**
 * Generates publisher schema data
 */
export function getPublisherSchema() {
  return {
    '@type': 'Person',
    name: SEO_CONFIG.author.name,
    url: SEO_CONFIG.siteUrl,
    logo: {
      '@type': 'ImageObject',
      url: SEO_CONFIG.defaultImage,
    },
  };
}

/**
 * Escape XML special characters for sitemap
 */
export function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Archive page types for programmatic SEO
 */
export type ArchiveType = 'category' | 'tag' | 'author' | 'date' | 'topic';

/**
 * Generates archive page metadata
 */
export function getArchiveMetadata(
  type: ArchiveType,
  value: string,
  articleCount: number
): { title: string; description: string; keywords: string } {
  const formattedValue = value
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  const configs: Record<ArchiveType, { title: string; description: string }> = {
    category: {
      title: `${formattedValue} Articles`,
      description: `Browse ${articleCount} articles about ${formattedValue}. Expert insights and guides on ${formattedValue.toLowerCase()} from Dan Pearson.`,
    },
    tag: {
      title: `Articles Tagged "${formattedValue}"`,
      description: `Explore ${articleCount} articles tagged with ${formattedValue}. In-depth coverage of ${formattedValue.toLowerCase()} topics.`,
    },
    author: {
      title: `Articles by ${formattedValue}`,
      description: `Read ${articleCount} articles written by ${formattedValue}. Expert perspectives on AI automation and business optimization.`,
    },
    date: {
      title: `Articles from ${formattedValue}`,
      description: `Browse articles published in ${formattedValue}. Archive of insights on AI, automation, and business.`,
    },
    topic: {
      title: `${formattedValue} - Topic Hub`,
      description: `Complete guide to ${formattedValue}. Browse ${articleCount} related articles, tutorials, and expert insights.`,
    },
  };

  const config = configs[type];

  return {
    title: getPageTitle(config.title),
    description: config.description,
    keywords: generateKeywords(
      [formattedValue, type, 'articles', 'guides'],
      undefined,
      ['archive', 'collection']
    ),
  };
}

/**
 * Internal link suggestion interface
 */
export interface InternalLinkSuggestion {
  text: string;
  url: string;
  relevance: number;
}

/**
 * Generates internal linking suggestions based on content
 */
export function generateInternalLinks(
  currentTags: string[],
  currentCategory: string,
  allCategories: string[],
  allTags: string[]
): InternalLinkSuggestion[] {
  const suggestions: InternalLinkSuggestion[] = [];

  // Category archive links
  if (currentCategory) {
    suggestions.push({
      text: `More ${currentCategory} articles`,
      url: `/news/category/${currentCategory}`,
      relevance: 10,
    });
  }

  // Related category links
  allCategories
    .filter(cat => cat !== currentCategory)
    .slice(0, 3)
    .forEach(cat => {
      suggestions.push({
        text: `Explore ${cat}`,
        url: `/news/category/${cat}`,
        relevance: 5,
      });
    });

  // Tag archive links
  currentTags.slice(0, 5).forEach(tag => {
    const tagSlug = generateSlug(tag);
    suggestions.push({
      text: `More on ${tag}`,
      url: `/news/tag/${tagSlug}`,
      relevance: 8,
    });
  });

  return suggestions.sort((a, b) => b.relevance - a.relevance);
}

/**
 * Core Web Vitals thresholds for SEO
 */
export const CORE_WEB_VITALS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  TTFB: { good: 800, poor: 1800 },
} as const;
