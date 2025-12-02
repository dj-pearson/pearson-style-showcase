import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';

const BASE_URL = 'https://danpearson.net';

// Routes that should not be indexed (no canonical)
const NO_INDEX_ROUTES = [
  '/admin',
  '/auth',
  '/sitemap.xml',
  '/robots.txt',
];

// Route patterns for canonical URL generation
const ROUTE_PATTERNS: Record<string, { priority: number; changefreq: string }> = {
  '/': { priority: 1.0, changefreq: 'weekly' },
  '/about': { priority: 0.8, changefreq: 'monthly' },
  '/projects': { priority: 0.9, changefreq: 'weekly' },
  '/news': { priority: 0.9, changefreq: 'daily' },
  '/ai-tools': { priority: 0.8, changefreq: 'weekly' },
  '/connect': { priority: 0.7, changefreq: 'monthly' },
};

interface CanonicalUrlResult {
  canonicalUrl: string;
  shouldIndex: boolean;
  priority: number;
  changefreq: string;
}

/**
 * Hook to automatically generate canonical URLs based on current route
 * Handles query param stripping, trailing slash normalization, and noindex routes
 */
export const useCanonicalUrl = (customPath?: string): CanonicalUrlResult => {
  const location = useLocation();
  
  return useMemo(() => {
    const path = customPath || location.pathname;
    
    // Normalize path: remove trailing slash (except for root)
    const normalizedPath = path === '/' ? '/' : path.replace(/\/$/, '');
    
    // Check if route should not be indexed
    const shouldIndex = !NO_INDEX_ROUTES.some(route => normalizedPath.startsWith(route));
    
    // Generate canonical URL (always without query params or hash)
    const canonicalUrl = `${BASE_URL}${normalizedPath}`;
    
    // Determine priority and changefreq based on route pattern
    let priority = 0.5;
    let changefreq = 'monthly';
    
    // Check exact matches first
    if (ROUTE_PATTERNS[normalizedPath]) {
      priority = ROUTE_PATTERNS[normalizedPath].priority;
      changefreq = ROUTE_PATTERNS[normalizedPath].changefreq;
    } 
    // Check if it's an article page
    else if (normalizedPath.startsWith('/news/')) {
      priority = 0.8;
      changefreq = 'monthly';
    }
    
    return {
      canonicalUrl,
      shouldIndex,
      priority,
      changefreq,
    };
  }, [location.pathname, customPath]);
};

/**
 * Utility function to generate canonical URL for a given path
 * Useful for sitemap generation and server-side scenarios
 */
export const generateCanonicalUrl = (path: string): string => {
  const normalizedPath = path === '/' ? '/' : path.replace(/\/$/, '');
  return `${BASE_URL}${normalizedPath}`;
};

/**
 * Check if a path should be indexed
 */
export const shouldIndexPath = (path: string): boolean => {
  return !NO_INDEX_ROUTES.some(route => path.startsWith(route));
};

export default useCanonicalUrl;
