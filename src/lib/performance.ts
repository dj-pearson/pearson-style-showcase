/**
 * Performance monitoring utilities for tracking Core Web Vitals
 * Helps identify performance bottlenecks in production
 */

import { logger } from './logger';

interface PerformanceMetric {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  timestamp: number;
}

/**
 * Rating thresholds based on web.dev recommendations
 */
const THRESHOLDS = {
  FCP: { good: 1800, poor: 3000 }, // First Contentful Paint
  LCP: { good: 2500, poor: 4000 }, // Largest Contentful Paint
  FID: { good: 100, poor: 300 },   // First Input Delay
  CLS: { good: 0.1, poor: 0.25 },  // Cumulative Layout Shift
  TTFB: { good: 800, poor: 1800 }, // Time to First Byte
  INP: { good: 200, poor: 500 },   // Interaction to Next Paint
};

/**
 * Get rating based on metric value and thresholds
 */
function getRating(
  metricName: keyof typeof THRESHOLDS,
  value: number
): 'good' | 'needs-improvement' | 'poor' {
  const threshold = THRESHOLDS[metricName];
  if (value <= threshold.good) return 'good';
  if (value <= threshold.poor) return 'needs-improvement';
  return 'poor';
}

/**
 * Report a performance metric (can be sent to analytics)
 */
function reportMetric(metric: PerformanceMetric) {
  logger.log(`[Performance] ${metric.name}: ${metric.value.toFixed(2)}ms - ${metric.rating}`);

  // In production, you could send this to your analytics service
  // Example: sendToAnalytics(metric);
}

/**
 * Measure First Contentful Paint (FCP)
 */
export function measureFCP() {
  if (!('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const fcpEntry = entries.find((entry) => entry.name === 'first-contentful-paint');

      if (fcpEntry) {
        const value = fcpEntry.startTime;
        reportMetric({
          name: 'FCP',
          value,
          rating: getRating('FCP', value),
          timestamp: Date.now(),
        });
        observer.disconnect();
      }
    });

    observer.observe({ entryTypes: ['paint'] });
  } catch (error) {
    logger.log('[Performance] Error measuring FCP:', error);
  }
}

/**
 * Measure Largest Contentful Paint (LCP)
 */
export function measureLCP() {
  if (!('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const lastEntry = entries[entries.length - 1] as PerformanceEntry & { renderTime?: number; loadTime?: number };

      if (lastEntry) {
        const value = lastEntry.renderTime || lastEntry.loadTime || lastEntry.startTime;
        reportMetric({
          name: 'LCP',
          value,
          rating: getRating('LCP', value),
          timestamp: Date.now(),
        });
      }
    });

    observer.observe({ entryTypes: ['largest-contentful-paint'] });

    // Stop observing after page is fully loaded
    window.addEventListener('load', () => {
      setTimeout(() => observer.disconnect(), 3000);
    });
  } catch (error) {
    logger.log('[Performance] Error measuring LCP:', error);
  }
}

/**
 * Measure First Input Delay (FID)
 */
export function measureFID() {
  if (!('PerformanceObserver' in window)) return;

  try {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const firstInput = entries[0] as PerformanceEntry & { processingStart?: number };

      if (firstInput && firstInput.processingStart) {
        const value = firstInput.processingStart - firstInput.startTime;
        reportMetric({
          name: 'FID',
          value,
          rating: getRating('FID', value),
          timestamp: Date.now(),
        });
        observer.disconnect();
      }
    });

    observer.observe({ entryTypes: ['first-input'] });
  } catch (error) {
    logger.log('[Performance] Error measuring FID:', error);
  }
}

/**
 * Measure Cumulative Layout Shift (CLS)
 */
export function measureCLS() {
  if (!('PerformanceObserver' in window)) return;

  let clsValue = 0;
  let sessionValue = 0;
  let sessionEntries: PerformanceEntry[] = [];

  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { value?: number; hadRecentInput?: boolean })[]) {
        // Only count layout shifts without recent user input
        if (!entry.hadRecentInput) {
          const firstSessionEntry = sessionEntries[0];
          const lastSessionEntry = sessionEntries[sessionEntries.length - 1];

          // If the entry is less than 1 second after the previous entry and
          // less than 5 seconds after the first entry in the session, include it
          if (
            sessionValue &&
            entry.startTime - lastSessionEntry.startTime < 1000 &&
            entry.startTime - firstSessionEntry.startTime < 5000
          ) {
            sessionValue += entry.value || 0;
            sessionEntries.push(entry);
          } else {
            sessionValue = entry.value || 0;
            sessionEntries = [entry];
          }

          // Update CLS value if this session is the largest
          if (sessionValue > clsValue) {
            clsValue = sessionValue;
          }
        }
      }
    });

    observer.observe({ entryTypes: ['layout-shift'] });

    // Report CLS when page is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        reportMetric({
          name: 'CLS',
          value: clsValue,
          rating: getRating('CLS', clsValue),
          timestamp: Date.now(),
        });
        observer.disconnect();
      }
    });
  } catch (error) {
    logger.log('[Performance] Error measuring CLS:', error);
  }
}

/**
 * Measure Time to First Byte (TTFB)
 */
export function measureTTFB() {
  try {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;

    if (navigation) {
      const value = navigation.responseStart - navigation.requestStart;
      reportMetric({
        name: 'TTFB',
        value,
        rating: getRating('TTFB', value),
        timestamp: Date.now(),
      });
    }
  } catch (error) {
    logger.log('[Performance] Error measuring TTFB:', error);
  }
}

/**
 * Initialize all performance monitoring
 */
export function initPerformanceMonitoring() {
  // Only run in browser environment
  if (typeof window === 'undefined') return;

  // Wait for page to be interactive before measuring
  if (document.readyState === 'complete') {
    measureAll();
  } else {
    window.addEventListener('load', measureAll);
  }
}

/**
 * Measure all Core Web Vitals
 */
function measureAll() {
  measureFCP();
  measureLCP();
  measureFID();
  measureCLS();
  measureTTFB();
}

/**
 * Custom performance marker for measuring custom operations
 */
export function measureCustom(name: string, startMark: string, endMark: string) {
  try {
    performance.mark(endMark);
    performance.measure(name, startMark, endMark);

    const measure = performance.getEntriesByName(name)[0];
    if (measure) {
      logger.log(`[Performance] ${name}: ${measure.duration.toFixed(2)}ms`);
    }

    // Clean up marks and measures
    performance.clearMarks(startMark);
    performance.clearMarks(endMark);
    performance.clearMeasures(name);
  } catch (error) {
    logger.log(`[Performance] Error measuring ${name}:`, error);
  }
}

/**
 * Mark the start of a custom operation
 */
export function markStart(name: string) {
  try {
    performance.mark(`${name}-start`);
  } catch (error) {
    logger.log(`[Performance] Error marking ${name}:`, error);
  }
}

/**
 * Mark the end of a custom operation and measure duration
 */
export function markEnd(name: string) {
  measureCustom(name, `${name}-start`, `${name}-end`);
}
