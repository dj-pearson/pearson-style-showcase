import { useEffect } from 'react';
import { runTrafficDetection } from '@/lib/traffic-detection';

/**
 * Runs odd-traffic detection once per session, at the first idle moment, so that
 * Google Analytics tracking and heavy 3D assets can consult the cached result
 * (`shouldSuppressForOddTraffic`) and skip themselves for flagged visitors.
 *
 * Renders nothing. Detection is fully best-effort: any failure simply leaves
 * the visitor un-flagged (fail-open), so real users are never affected.
 */
const TrafficGuard = () => {
  useEffect(() => {
    // Deferred to idle time so the /cdn-cgi/trace fetch, the traffic_rules
    // select and the page_visits insert don't compete with first-paint
    // requests. Nothing waits on this: consumers read the cached result and
    // treat "not yet evaluated" as un-flagged, exactly as before.
    const run = () => {
      void runTrafficDetection();
    };

    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(run, { timeout: 2000 });
      return () => window.cancelIdleCallback(handle);
    }
    const timer = window.setTimeout(run, 2000);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
};

export default TrafficGuard;
