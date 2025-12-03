/**
 * Production Error Tracking Service
 *
 * Provides centralized error tracking for production environments.
 * Can integrate with external services like Sentry, LogRocket, or custom endpoints.
 *
 * Features:
 * - Error deduplication
 * - Context enrichment
 * - Rate limiting to prevent flood
 * - Offline queue with retry
 * - Privacy-safe error reporting
 */

import { maskPII, sanitizeObject } from '@/lib/production-logger';

// Configuration
const ERROR_TRACKING_ENDPOINT = import.meta.env.VITE_ERROR_TRACKING_ENDPOINT || '';
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';
const ERROR_SAMPLE_RATE = parseFloat(import.meta.env.VITE_ERROR_SAMPLE_RATE || '1.0');
const MAX_ERRORS_PER_MINUTE = 10;
const ERROR_DEDUP_WINDOW = 5 * 60 * 1000; // 5 minutes

// Check if we're in production
const isProduction = import.meta.env.PROD === true;

// Error tracking state
interface ErrorEntry {
  fingerprint: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
}

const errorCache = new Map<string, ErrorEntry>();
const errorQueue: ErrorReport[] = [];
let errorsThisMinute = 0;
let lastMinuteReset = Date.now();

// Error severity levels
export type ErrorSeverity = 'fatal' | 'error' | 'warning' | 'info';

// Error report structure
export interface ErrorReport {
  id: string;
  timestamp: string;
  severity: ErrorSeverity;
  message: string;
  stack?: string;
  fingerprint: string;
  context: {
    url: string;
    userAgent: string;
    viewport: { width: number; height: number };
    component?: string;
    userId?: string;
    sessionId?: string;
    buildVersion?: string;
  };
  tags: Record<string, string>;
  extra: Record<string, unknown>;
  breadcrumbs: Breadcrumb[];
}

// Breadcrumb for tracking user journey
export interface Breadcrumb {
  timestamp: string;
  category: string;
  message: string;
  level: 'debug' | 'info' | 'warning' | 'error';
  data?: Record<string, unknown>;
}

// Breadcrumb buffer
const breadcrumbs: Breadcrumb[] = [];
const MAX_BREADCRUMBS = 50;

// Session tracking
let sessionId: string | null = null;
let currentUserId: string | null = null;

/**
 * Initialize the error tracking service
 */
export function initErrorTracking(options?: {
  userId?: string;
  tags?: Record<string, string>;
}): void {
  // Generate session ID
  sessionId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  if (options?.userId) {
    currentUserId = options.userId;
  }

  // Set up global error handlers
  if (typeof window !== 'undefined') {
    // Unhandled errors
    window.addEventListener('error', (event) => {
      captureException(event.error || new Error(event.message), {
        tags: { type: 'unhandled_error' },
        extra: {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
        },
      });
    });

    // Unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      const error = event.reason instanceof Error
        ? event.reason
        : new Error(String(event.reason));

      captureException(error, {
        tags: { type: 'unhandled_rejection' },
      });
    });

    // Track navigation for breadcrumbs
    const originalPushState = history.pushState;
    history.pushState = function(...args) {
      addBreadcrumb({
        category: 'navigation',
        message: `Navigate to ${args[2]}`,
        level: 'info',
        data: { from: window.location.pathname, to: args[2] },
      });
      return originalPushState.apply(this, args);
    };

    // Track clicks for breadcrumbs
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'BUTTON' || target.tagName === 'A' || target.closest('button') || target.closest('a')) {
        const text = target.textContent?.substring(0, 50) || target.getAttribute('aria-label') || 'unknown';
        addBreadcrumb({
          category: 'ui.click',
          message: `Click on ${target.tagName.toLowerCase()}: ${text}`,
          level: 'info',
        });
      }
    }, { capture: true });
  }

  console.log('[ErrorTracking] Initialized', {
    sessionId,
    isProduction,
    hasSentry: !!SENTRY_DSN,
    hasCustomEndpoint: !!ERROR_TRACKING_ENDPOINT,
  });
}

/**
 * Set the current user for error context
 */
export function setUser(userId: string | null): void {
  currentUserId = userId;
  addBreadcrumb({
    category: 'auth',
    message: userId ? 'User logged in' : 'User logged out',
    level: 'info',
  });
}

/**
 * Add a breadcrumb for context
 */
export function addBreadcrumb(crumb: Omit<Breadcrumb, 'timestamp'>): void {
  const breadcrumb: Breadcrumb = {
    ...crumb,
    timestamp: new Date().toISOString(),
  };

  breadcrumbs.push(breadcrumb);

  // Keep buffer size limited
  if (breadcrumbs.length > MAX_BREADCRUMBS) {
    breadcrumbs.shift();
  }
}

/**
 * Generate a fingerprint for error deduplication
 */
function generateFingerprint(error: Error, component?: string): string {
  const parts = [
    error.name,
    error.message.substring(0, 100),
    component || '',
    error.stack?.split('\n')[1]?.trim() || '',
  ];

  return parts.join('|');
}

/**
 * Check rate limiting
 */
function checkRateLimit(): boolean {
  const now = Date.now();

  // Reset counter every minute
  if (now - lastMinuteReset > 60000) {
    errorsThisMinute = 0;
    lastMinuteReset = now;
  }

  if (errorsThisMinute >= MAX_ERRORS_PER_MINUTE) {
    return false;
  }

  errorsThisMinute++;
  return true;
}

/**
 * Check if error should be deduplicated
 */
function shouldReportError(fingerprint: string): boolean {
  const now = Date.now();
  const existing = errorCache.get(fingerprint);

  if (!existing) {
    errorCache.set(fingerprint, {
      fingerprint,
      count: 1,
      firstSeen: now,
      lastSeen: now,
    });
    return true;
  }

  // If outside dedup window, allow reporting again
  if (now - existing.lastSeen > ERROR_DEDUP_WINDOW) {
    existing.count = 1;
    existing.lastSeen = now;
    return true;
  }

  // Update count but don't report
  existing.count++;
  existing.lastSeen = now;

  // Report again if count hits certain thresholds (1, 10, 100, etc.)
  const shouldReport = Math.log10(existing.count) % 1 === 0;
  return shouldReport;
}

/**
 * Sample error based on configured rate
 */
function shouldSampleError(): boolean {
  return Math.random() < ERROR_SAMPLE_RATE;
}

/**
 * Create an error report
 */
function createErrorReport(
  error: Error,
  severity: ErrorSeverity,
  options?: {
    component?: string;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): ErrorReport {
  const fingerprint = generateFingerprint(error, options?.component);

  return {
    id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date().toISOString(),
    severity,
    message: maskPII(error.message),
    stack: isProduction ? undefined : error.stack,
    fingerprint,
    context: {
      url: window.location.href,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      component: options?.component,
      userId: currentUserId ? maskPII(currentUserId) : undefined,
      sessionId: sessionId || undefined,
      buildVersion: import.meta.env.VITE_BUILD_VERSION || undefined,
    },
    tags: {
      environment: isProduction ? 'production' : 'development',
      ...options?.tags,
    },
    extra: options?.extra ? sanitizeObject(options.extra) as Record<string, unknown> : {},
    breadcrumbs: [...breadcrumbs],
  };
}

/**
 * Send error report to tracking service
 */
async function sendErrorReport(report: ErrorReport): Promise<void> {
  // Try Sentry first if configured
  if (SENTRY_DSN) {
    try {
      await sendToSentry(report);
      return;
    } catch (err) {
      console.warn('[ErrorTracking] Sentry send failed, trying custom endpoint:', err);
    }
  }

  // Try custom endpoint
  if (ERROR_TRACKING_ENDPOINT) {
    try {
      await sendToCustomEndpoint(report);
      return;
    } catch (err) {
      console.warn('[ErrorTracking] Custom endpoint send failed:', err);
    }
  }

  // Queue for retry if all methods fail
  errorQueue.push(report);

  // Limit queue size
  if (errorQueue.length > 100) {
    errorQueue.shift();
  }
}

/**
 * Send to Sentry-compatible endpoint
 */
async function sendToSentry(report: ErrorReport): Promise<void> {
  // Sentry envelope format
  const envelope = {
    event_id: report.id.replace(/-/g, ''),
    timestamp: report.timestamp,
    platform: 'javascript',
    level: report.severity,
    logger: 'javascript',
    message: report.message,
    exception: {
      values: [{
        type: 'Error',
        value: report.message,
        stacktrace: report.stack ? { frames: parseStackTrace(report.stack) } : undefined,
      }],
    },
    tags: report.tags,
    extra: report.extra,
    user: report.context.userId ? { id: report.context.userId } : undefined,
    contexts: {
      browser: {
        name: getBrowserName(),
        version: getBrowserVersion(),
      },
      device: {
        screen_width_pixels: report.context.viewport.width,
        screen_height_pixels: report.context.viewport.height,
      },
    },
    breadcrumbs: report.breadcrumbs.map(b => ({
      timestamp: b.timestamp,
      category: b.category,
      message: b.message,
      level: b.level,
      data: b.data,
    })),
  };

  const response = await fetch(SENTRY_DSN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(envelope),
  });

  if (!response.ok) {
    throw new Error(`Sentry responded with ${response.status}`);
  }
}

/**
 * Send to custom error tracking endpoint
 */
async function sendToCustomEndpoint(report: ErrorReport): Promise<void> {
  const response = await fetch(ERROR_TRACKING_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(report),
  });

  if (!response.ok) {
    throw new Error(`Custom endpoint responded with ${response.status}`);
  }
}

/**
 * Parse stack trace into frames
 */
function parseStackTrace(stack: string): Array<{ filename: string; lineno: number; colno: number; function: string }> {
  const lines = stack.split('\n').slice(1);
  return lines.map(line => {
    const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):(\d+)\)/) ||
                  line.match(/at\s+(.+?):(\d+):(\d+)/);

    if (match) {
      return {
        function: match[1] || '<anonymous>',
        filename: match[2] || match[1] || '<unknown>',
        lineno: parseInt(match[3] || match[2] || '0', 10),
        colno: parseInt(match[4] || match[3] || '0', 10),
      };
    }

    return {
      function: '<unknown>',
      filename: '<unknown>',
      lineno: 0,
      colno: 0,
    };
  }).filter(frame => frame.filename !== '<unknown>');
}

/**
 * Get browser name
 */
function getBrowserName(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Edge')) return 'Edge';
  return 'Unknown';
}

/**
 * Get browser version
 */
function getBrowserVersion(): string {
  const ua = navigator.userAgent;
  const match = ua.match(/(Firefox|Chrome|Safari|Edge)\/(\d+)/);
  return match ? match[2] : 'Unknown';
}

/**
 * Capture an exception
 */
export function captureException(
  error: Error | unknown,
  options?: {
    component?: string;
    severity?: ErrorSeverity;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): string | null {
  const err = error instanceof Error ? error : new Error(String(error));
  const severity = options?.severity || 'error';

  // Skip in development unless explicitly enabled
  if (!isProduction && !import.meta.env.VITE_ERROR_TRACKING_DEV) {
    console.error('[ErrorTracking] Would capture:', err.message, options);
    return null;
  }

  // Rate limiting
  if (!checkRateLimit()) {
    console.warn('[ErrorTracking] Rate limited, dropping error');
    return null;
  }

  // Sampling
  if (!shouldSampleError()) {
    console.debug('[ErrorTracking] Sampled out, dropping error');
    return null;
  }

  const fingerprint = generateFingerprint(err, options?.component);

  // Deduplication
  if (!shouldReportError(fingerprint)) {
    console.debug('[ErrorTracking] Deduplicated, dropping error');
    return null;
  }

  const report = createErrorReport(err, severity, options);

  // Send asynchronously
  sendErrorReport(report).catch(sendErr => {
    console.error('[ErrorTracking] Failed to send error report:', sendErr);
  });

  return report.id;
}

/**
 * Capture a message (for non-exception events)
 */
export function captureMessage(
  message: string,
  options?: {
    severity?: ErrorSeverity;
    component?: string;
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }
): string | null {
  const error = new Error(message);
  error.name = 'Message';
  return captureException(error, {
    ...options,
    severity: options?.severity || 'info',
  });
}

/**
 * Wrap a function to automatically capture errors
 */
export function withErrorTracking<T extends (...args: unknown[]) => unknown>(
  fn: T,
  options?: {
    component?: string;
    tags?: Record<string, string>;
  }
): T {
  return ((...args: Parameters<T>) => {
    try {
      const result = fn(...args);

      // Handle promises
      if (result instanceof Promise) {
        return result.catch((error) => {
          captureException(error, options);
          throw error;
        });
      }

      return result;
    } catch (error) {
      captureException(error, options);
      throw error;
    }
  }) as T;
}

/**
 * React Error Boundary helper
 */
export function captureReactError(
  error: Error,
  errorInfo: { componentStack?: string }
): string | null {
  return captureException(error, {
    component: 'ErrorBoundary',
    tags: { type: 'react_error' },
    extra: {
      componentStack: errorInfo.componentStack,
    },
  });
}

/**
 * Flush pending error queue
 */
export async function flushErrorQueue(): Promise<void> {
  const queue = [...errorQueue];
  errorQueue.length = 0;

  for (const report of queue) {
    try {
      await sendErrorReport(report);
    } catch (err) {
      console.warn('[ErrorTracking] Failed to flush queued error:', err);
      errorQueue.push(report); // Re-queue on failure
    }
  }
}

/**
 * Get error tracking stats
 */
export function getErrorTrackingStats(): {
  sessionId: string | null;
  errorCount: number;
  queuedErrors: number;
  breadcrumbCount: number;
  uniqueErrors: number;
} {
  return {
    sessionId,
    errorCount: errorsThisMinute,
    queuedErrors: errorQueue.length,
    breadcrumbCount: breadcrumbs.length,
    uniqueErrors: errorCache.size,
  };
}
