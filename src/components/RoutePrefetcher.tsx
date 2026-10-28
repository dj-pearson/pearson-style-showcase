import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { routeComponents, type RouteComponentName } from '@/lib/routeComponents';

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (id: number) => void;
};

// Which route chunks to warm from each page. Fetching the HTML documents
// instead (the old <link rel=prefetch as=document>) was wasted: HTML is served
// with max-age=0, so the browser revalidated it on click anyway, and the JS
// chunk the click actually waits on was never fetched.
const PREFETCH_MAP: Record<string, RouteComponentName[]> = {
  '/': ['Projects', 'News', 'AITools', 'Connect', 'Topics'],
  '/projects': ['News', 'AITools', 'Connect'],
  '/news': ['Projects', 'AITools', 'Topics', 'Article'],
  '/ai-tools': ['Projects', 'News', 'Topics'],
  '/about': ['Projects', 'Connect'],
  '/connect': ['Projects', 'News'],
  '/topics': ['News', 'AITools', 'Projects', 'TopicHub'],
  '/faq': ['Connect', 'News', 'Topics'],
};

function isConstrainedConnection(): boolean {
  const conn = (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
  return Boolean(
    conn && (conn.saveData || conn.effectiveType === 'slow-2g' || conn.effectiveType === '2g')
  );
}

/**
 * Preloads the JS chunks of likely next routes during idle time, so a click
 * renders without waiting on a chunk fetch. Skipped on Save-Data and 2g.
 */
const RoutePrefetcher = () => {
  const location = useLocation();
  const prefetched = useRef<Set<RouteComponentName>>(new Set());

  useEffect(() => {
    if (isConstrainedConnection()) return;

    const pending = (PREFETCH_MAP[location.pathname] ?? []).filter(
      (name) => !prefetched.current.has(name)
    );
    if (pending.length === 0) return;

    const run = () => {
      for (const name of pending) {
        prefetched.current.add(name);
        // A failed prefetch is harmless; the route retries on navigation.
        routeComponents[name].preload().catch(() => {
          prefetched.current.delete(name);
        });
      }
    };

    const w = window as IdleWindow;
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(run, { timeout: 5000 });
      return () => w.cancelIdleCallback?.(id);
    }
    // Safari has no requestIdleCallback.
    const timeoutId = setTimeout(run, 2000);
    return () => clearTimeout(timeoutId);
  }, [location.pathname]);

  return null;
};

export default RoutePrefetcher;
