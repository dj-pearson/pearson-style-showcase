import { useEffect } from 'react';
import { runTrafficDetection } from '@/lib/traffic-detection';

/**
 * Runs odd-traffic detection once per session as early as possible, so that
 * Google Analytics tracking and heavy 3D assets can consult the cached result
 * (`shouldSuppressForOddTraffic`) and skip themselves for flagged visitors.
 *
 * Renders nothing. Detection is fully best-effort: any failure simply leaves
 * the visitor un-flagged (fail-open), so real users are never affected.
 */
const TrafficGuard = () => {
  useEffect(() => {
    void runTrafficDetection();
  }, []);

  return null;
};

export default TrafficGuard;
