import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * RoutePrefetcher - Intelligently prefetches common routes during idle time
 * This improves perceived navigation speed by loading routes before user clicks
 */
const RoutePrefetcher = () => {
  const location = useLocation();

  useEffect(() => {
    // Only prefetch on fast connections to avoid wasting bandwidth
    if ('connection' in navigator) {
      const conn = (navigator as any).connection;
      if (conn && (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g')) {
        return; // Don't prefetch on slow connections or data saver mode
      }
    }

    // Wait for idle time before prefetching to avoid blocking critical resources
    const prefetchTimer = setTimeout(() => {
      // Define prefetch strategy based on current page
      const prefetchMap: Record<string, string[]> = {
        '/': ['/projects', '/news', '/ai-tools', '/connect'],
        '/projects': ['/news', '/ai-tools', '/connect'],
        '/news': ['/projects', '/ai-tools'],
        '/ai-tools': ['/projects', '/news'],
        '/about': ['/projects', '/connect'],
        '/connect': ['/projects', '/news'],
      };

      const routesToPrefetch = prefetchMap[location.pathname] || [];

      routesToPrefetch.forEach((route) => {
        // Create a prefetch link element
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = route;
        link.as = 'document';

        // Add to document head
        document.head.appendChild(link);
      });
    }, 2000); // Wait 2 seconds after page load before prefetching

    return () => clearTimeout(prefetchTimer);
  }, [location.pathname]);

  return null; // This component doesn't render anything
};

export default RoutePrefetcher;
