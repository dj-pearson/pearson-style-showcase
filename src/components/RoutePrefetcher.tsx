import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * RoutePrefetcher - Intelligently prefetches common routes during idle time
 * This improves perceived navigation speed by loading routes before user clicks
 *
 * Performance optimizations:
 * - Uses requestIdleCallback to avoid blocking main thread
 * - Batches DOM operations using DocumentFragment
 * - Deduplicates prefetch links to avoid redundant requests
 */
const RoutePrefetcher = () => {
  const location = useLocation();
  const prefetchedRoutes = useRef<Set<string>>(new Set());

  useEffect(() => {
    // Only prefetch on fast connections to avoid wasting bandwidth
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      if (conn && (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g')) {
        return; // Don't prefetch on slow connections or data saver mode
      }
    }

    // Define prefetch strategy based on current page
    const prefetchMap: Record<string, string[]> = {
      '/': ['/projects', '/news', '/ai-tools', '/connect', '/topics'],
      '/projects': ['/news', '/ai-tools', '/connect'],
      '/news': ['/projects', '/ai-tools', '/topics'],
      '/ai-tools': ['/projects', '/news', '/topics'],
      '/about': ['/projects', '/connect'],
      '/connect': ['/projects', '/news'],
      '/topics': ['/news', '/ai-tools', '/projects'],
      '/faq': ['/connect', '/news', '/topics'],
    };

    const routesToPrefetch = prefetchMap[location.pathname] || [];

    // Filter out already prefetched routes
    const newRoutes = routesToPrefetch.filter(route => !prefetchedRoutes.current.has(route));

    if (newRoutes.length === 0) {
      return; // Nothing new to prefetch
    }

    // Use requestIdleCallback to defer prefetching to idle time
    const prefetchRoutes = () => {
      // Batch DOM operations using DocumentFragment
      const fragment = document.createDocumentFragment();

      newRoutes.forEach((route) => {
        // Check if link already exists in document
        const existingLink = document.querySelector(`link[rel="prefetch"][href="${route}"]`);
        if (existingLink) {
          prefetchedRoutes.current.add(route);
          return;
        }

        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = route;
        link.as = 'document';
        fragment.appendChild(link);

        prefetchedRoutes.current.add(route);
      });

      // Single DOM operation instead of multiple appendChild calls
      if (fragment.childNodes.length > 0) {
        document.head.appendChild(fragment);
      }
    };

    // Use requestIdleCallback with timeout fallback
    let idleCallbackId: number | undefined;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if ('requestIdleCallback' in window) {
      idleCallbackId = (window as any).requestIdleCallback(prefetchRoutes, { timeout: 5000 });
    } else {
      // Fallback for Safari - wait 2 seconds after page load
      timeoutId = setTimeout(prefetchRoutes, 2000);
    }

    return () => {
      if (idleCallbackId !== undefined && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleCallbackId);
      }
      if (timeoutId !== undefined) {
        clearTimeout(timeoutId);
      }
    };
  }, [location.pathname]);

  return null;
};

export default RoutePrefetcher;
