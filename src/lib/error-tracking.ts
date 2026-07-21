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
import { Sentry } from '@/lib/sentry';

// Configuration
const ERROR_TRACKING_ENDPOINT = import.meta.env.VITE_ERROR_TRACKING_ENDPOINT || '';
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || '';
const ERROR_SAMPLE_RATE = parseFloat(import.meta.env.VITE_ERROR_SAMPLE_RATE || '1.0');
const MAX_ERRORS_PER_MINUTE = 10;
const ERROR_DEDUP_WINDOW = 5 * 60 * 1000; // 5 minutes

// Check if we're in production
const isProduction = import.meta.env.PROD === true;

/**
 * Strip PII from URLs before including in error reports.
 * Preserves the pathname for debugging but redacts query parameter values
 * and hash fragments (which may contain OAuth tokens).
 */
function sanitizeUrlForTracking(url: string): string {
  try {
    const parsed = new URL(url);
    // Redact query parameter values but keep keys for debugging
    const sanitizedParams = new URLSearchParams();
    parsed.searchParams.forEach((_value, key) => {
      sanitizedParams.set(key, '[REDACTED]');
    });
    const queryStr = sanitizedParams.toString();
    return parsed.origin + parsed.pathname + (queryStr ? '?' + queryStr : '');
  } catch {
    // If URL parsing fails, return just the pathname portion
    return window.location.pathname;
  }
}

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
      const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));

      captureException(error, {
        tags: { type: 'unhandled_rejection' },
      });
    });

    // Track navigation for breadcrumbs
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
      addBreadcrumb({
        category: 'navigation',
        message: `Navigate to ${args[2]}`,
        level: 'info',
        data: { from: window.location.pathname, to: args[2] },
      });
      return originalPushState.apply(this, args);
    };

    // Track clicks for breadcrumbs
    document.addEventListener(
      'click',
      (event) => {
        const target = event.target as HTMLElement;
        if (
          target.tagName === 'BUTTON' ||
          target.tagName === 'A' ||
          target.closest('button') ||
          target.closest('a')
        ) {
          const text =
            target.textContent?.substring(0, 50) || target.getAttribute('aria-label') || 'unknown';
          addBreadcrumb({
            category: 'ui.click',
            message: `Click on ${target.tagName.toLowerCase()}: ${text}`,
            level: 'info',
          });
        }
      },
      { capture: true }
    );
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
    message: maskPII(error.message.substring(0, 500)),
    stack: isProduction ? undefined : error.stack?.substring(0, 2000),
    fingerprint,
    context: {
      url: sanitizeUrlForTracking(window.location.href),
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
      },
      component: options?.component,
      userId: currentUserId ? maskPII(currentUserId.substring(0, 200)) : undefined,
      sessionId: sessionId?.substring(0, 200) || undefined,
      buildVersion: import.meta.env.VITE_BUILD_VERSION || undefined,
    },
    tags: {
      environment: isProduction ? 'production' : 'development',
      ...options?.tags,
    },
    extra: options?.extra ? (sanitizeObject(options.extra) as Record<string, unknown>) : {},
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
 * Map our internal severity to a Sentry severity level.
 */
function toSentryLevel(severity: ErrorSeverity): 'fatal' | 'error' | 'warning' | 'info' {
  switch (severity) {
    case 'fatal':
      return 'fatal';
    case 'warning':
      return 'warning';
    case 'info':
      return 'info';
    default:
      return 'error';
  }
}

/**
 * Route an error report to Sentry via the official @sentry/react SDK.
 *
 * Using the SDK (rather than hand-rolling an envelope POST to the raw DSN) means
 * events hit the correct ingest endpoint with the proper auth headers, and they
 * inherit the SDK's environment, release, and transport/retry behavior.
 *
 * Sentry.init() has already run at startup (main.tsx) whenever a DSN is set, so
 * these capture calls are wired to the same project DSN. Deduplication, rate
 * limiting, sampling, and PII masking have already been applied upstream.
 */
async function sendToSentry(report: ErrorReport): Promise<void> {
  Sentry.withScope((scope) => {
    scope.setLevel(toSentryLevel(report.severity));

    // Preserve our deduplication fingerprint so Sentry groups events the same way.
    scope.setFingerprint([report.fingerprint]);

    // Tags (environment, error type, component, etc.).
    scope.setTags(report.tags);
    if (report.context.component) {
      scope.setTag('component', report.context.component);
    }

    // Additional structured context (already sanitized upstream).
    scope.setExtras({
      ...report.extra,
      internalErrorId: report.id,
      sessionId: report.context.sessionId,
      buildVersion: report.context.buildVersion,
      url: report.context.url,
      viewport: report.context.viewport,
    });

    if (report.context.userId) {
      scope.setUser({ id: report.context.userId });
    }

    // Replay our breadcrumb trail onto the Sentry scope.
    for (const b of report.breadcrumbs) {
      scope.addBreadcrumb({
        category: b.category,
        message: b.message,
        level: b.level,
        data: b.data,
        timestamp: new Date(b.timestamp).getTime() / 1000,
      });
    }

    // Reconstruct an Error carrying our (masked) message + stack so Sentry can
    // build a proper exception/stacktrace group.
    const error = new Error(report.message);
    error.name = report.severity === 'info' ? 'Message' : 'Error';
    if (report.stack) {
      error.stack = report.stack;
    }

    Sentry.captureException(error);
  });
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
  sendErrorReport(report).catch((sendErr) => {
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
  errorInfo: { componentStack?: string; section?: string }
): string | null {
  return captureException(error, {
    component: 'ErrorBoundary',
    tags: { type: 'react_error' },
    extra: {
      componentStack: errorInfo.componentStack,
      section: errorInfo.section,
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
