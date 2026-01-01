/**
 * Async Utilities with Retry Support
 *
 * Provides consistent patterns for handling async operations with:
 * - Exponential backoff retry
 * - Configurable retry strategies
 * - Error categorization
 * - Timeout handling
 * - Circuit breaker pattern
 */

import { captureException } from '@/lib/error-tracking';

/**
 * Error types that may be retryable
 */
export type RetryableErrorType =
  | 'network'
  | 'timeout'
  | 'rate_limit'
  | 'server_error'
  | 'unknown';

/**
 * Retry configuration options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms before first retry (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in ms between retries (default: 30000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Add jitter to prevent thundering herd (default: true) */
  jitter?: boolean;
  /** Custom function to determine if error is retryable */
  isRetryable?: (error: unknown) => boolean;
  /** Callback on each retry attempt */
  onRetry?: (attempt: number, error: unknown, nextDelay: number) => void;
  /** Timeout for each attempt in ms (default: 30000) */
  timeout?: number;
  /** Abort signal for cancellation */
  signal?: AbortSignal;
}

/**
 * Result of an async operation with retry
 */
export interface AsyncResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
  totalTime: number;
}

/**
 * Default retry options
 */
const DEFAULT_RETRY_OPTIONS: Required<Omit<RetryOptions, 'isRetryable' | 'onRetry' | 'signal'>> = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
  jitter: true,
  timeout: 30000,
};

/**
 * Check if an error is retryable based on common patterns
 */
export function isRetryableError(error: unknown): boolean {
  if (!error) return false;

  // Network errors
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  // Abort errors should not be retried
  if (error instanceof DOMException && error.name === 'AbortError') {
    return false;
  }

  // Check for HTTP status codes in error messages
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Rate limiting - should retry with backoff
    if (message.includes('429') || message.includes('rate limit')) {
      return true;
    }

    // Server errors - may be transient
    if (message.includes('500') || message.includes('502') ||
        message.includes('503') || message.includes('504')) {
      return true;
    }

    // Network-related errors
    if (message.includes('network') || message.includes('timeout') ||
        message.includes('econnreset') || message.includes('econnrefused')) {
      return true;
    }

    // Client errors - typically not retryable
    if (message.includes('400') || message.includes('401') ||
        message.includes('403') || message.includes('404')) {
      return false;
    }
  }

  return false;
}

/**
 * Categorize an error for better handling
 */
export function categorizeError(error: unknown): RetryableErrorType {
  if (!error) return 'unknown';

  if (error instanceof TypeError && error.message.includes('fetch')) {
    return 'network';
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('timeout')) return 'timeout';
    if (message.includes('429') || message.includes('rate limit')) return 'rate_limit';
    if (message.includes('500') || message.includes('502') ||
        message.includes('503') || message.includes('504')) return 'server_error';
    if (message.includes('network') || message.includes('econnreset')) return 'network';
  }

  return 'unknown';
}

/**
 * Calculate delay with exponential backoff and optional jitter
 */
function calculateDelay(
  attempt: number,
  options: Required<Omit<RetryOptions, 'isRetryable' | 'onRetry' | 'signal'>>
): number {
  const exponentialDelay = options.initialDelay * Math.pow(options.backoffMultiplier, attempt - 1);
  const cappedDelay = Math.min(exponentialDelay, options.maxDelay);

  if (options.jitter) {
    // Add +/- 25% jitter
    const jitterRange = cappedDelay * 0.25;
    return cappedDelay + (Math.random() * 2 - 1) * jitterRange;
  }

  return cappedDelay;
}

/**
 * Create a promise that rejects after a timeout
 */
function createTimeoutPromise(ms: number, signal?: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${ms}ms`));
    }, ms);

    signal?.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      reject(new DOMException('Operation aborted', 'AbortError'));
    });
  });
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(resolve, ms);

    signal?.addEventListener('abort', () => {
      clearTimeout(timeoutId);
      reject(new DOMException('Operation aborted', 'AbortError'));
    });
  });
}

/**
 * Execute an async function with retry support
 *
 * @example
 * ```typescript
 * const result = await withRetry(
 *   () => fetch('/api/data').then(r => r.json()),
 *   { maxRetries: 3, initialDelay: 1000 }
 * );
 *
 * if (result.success) {
 *   console.log('Data:', result.data);
 * } else {
 *   console.error('Failed after', result.attempts, 'attempts');
 * }
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<AsyncResult<T>> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  const startTime = Date.now();
  let lastError: Error | undefined;
  let attempts = 0;

  const shouldRetry = opts.isRetryable || isRetryableError;

  while (attempts <= opts.maxRetries) {
    attempts++;

    try {
      // Check if aborted before attempting
      if (opts.signal?.aborted) {
        throw new DOMException('Operation aborted', 'AbortError');
      }

      // Race between the operation and timeout
      const result = await Promise.race([
        fn(),
        createTimeoutPromise(opts.timeout, opts.signal),
      ]);

      return {
        success: true,
        data: result,
        attempts,
        totalTime: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry aborted operations
      if (error instanceof DOMException && error.name === 'AbortError') {
        return {
          success: false,
          error: lastError,
          attempts,
          totalTime: Date.now() - startTime,
        };
      }

      // Check if we should retry
      if (attempts > opts.maxRetries || !shouldRetry(error)) {
        break;
      }

      // Calculate delay for next attempt
      const delay = calculateDelay(attempts, opts);

      // Call retry callback if provided
      opts.onRetry?.(attempts, error, delay);

      // Wait before next attempt
      try {
        await sleep(delay, opts.signal);
      } catch {
        // Aborted during sleep
        return {
          success: false,
          error: lastError,
          attempts,
          totalTime: Date.now() - startTime,
        };
      }
    }
  }

  // Track failed operations
  captureException(lastError, {
    component: 'async-utils',
    tags: { type: 'retry_exhausted' },
    extra: { attempts, totalTime: Date.now() - startTime },
  });

  return {
    success: false,
    error: lastError,
    attempts,
    totalTime: Date.now() - startTime,
  };
}

/**
 * Execute multiple async operations with individual retry
 *
 * @example
 * ```typescript
 * const results = await withRetryAll([
 *   () => fetchUsers(),
 *   () => fetchPosts(),
 *   () => fetchComments(),
 * ]);
 *
 * const [users, posts, comments] = results.map(r => r.data);
 * ```
 */
export async function withRetryAll<T>(
  fns: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<Array<AsyncResult<T>>> {
  return Promise.all(fns.map(fn => withRetry(fn, options)));
}

/**
 * Execute async operations sequentially with retry
 */
export async function withRetrySequential<T>(
  fns: Array<() => Promise<T>>,
  options: RetryOptions = {}
): Promise<Array<AsyncResult<T>>> {
  const results: Array<AsyncResult<T>> = [];

  for (const fn of fns) {
    const result = await withRetry(fn, options);
    results.push(result);

    // Stop on first failure if aborted
    if (options.signal?.aborted) break;
  }

  return results;
}

/**
 * Circuit breaker state
 */
interface CircuitBreakerState {
  failures: number;
  lastFailure: number;
  isOpen: boolean;
}

const circuitBreakers = new Map<string, CircuitBreakerState>();

/**
 * Circuit breaker options
 */
export interface CircuitBreakerOptions {
  /** Number of failures before opening circuit (default: 5) */
  failureThreshold?: number;
  /** Time in ms before attempting to close circuit (default: 30000) */
  resetTimeout?: number;
  /** Unique identifier for this circuit */
  circuitId: string;
}

/**
 * Execute an async function with circuit breaker pattern
 *
 * Prevents repeated calls to a failing service by "opening" the circuit
 * after a threshold of failures.
 *
 * @example
 * ```typescript
 * const result = await withCircuitBreaker(
 *   () => fetch('/api/external-service'),
 *   { circuitId: 'external-service', failureThreshold: 3 }
 * );
 * ```
 */
export async function withCircuitBreaker<T>(
  fn: () => Promise<T>,
  options: CircuitBreakerOptions & RetryOptions
): Promise<AsyncResult<T>> {
  const { circuitId, failureThreshold = 5, resetTimeout = 30000, ...retryOptions } = options;

  // Get or create circuit state
  let state = circuitBreakers.get(circuitId);
  if (!state) {
    state = { failures: 0, lastFailure: 0, isOpen: false };
    circuitBreakers.set(circuitId, state);
  }

  // Check if circuit is open
  if (state.isOpen) {
    const timeSinceFailure = Date.now() - state.lastFailure;

    if (timeSinceFailure < resetTimeout) {
      // Circuit is still open
      return {
        success: false,
        error: new Error(`Circuit breaker open for ${circuitId}`),
        attempts: 0,
        totalTime: 0,
      };
    }

    // Try to close circuit (half-open state)
    state.isOpen = false;
  }

  // Execute with retry
  const result = await withRetry(fn, retryOptions);

  if (result.success) {
    // Reset failures on success
    state.failures = 0;
  } else {
    // Track failure
    state.failures++;
    state.lastFailure = Date.now();

    // Open circuit if threshold reached
    if (state.failures >= failureThreshold) {
      state.isOpen = true;
    }
  }

  return result;
}

/**
 * Get circuit breaker status
 */
export function getCircuitBreakerStatus(circuitId: string): {
  isOpen: boolean;
  failures: number;
  lastFailure: number;
} | null {
  const state = circuitBreakers.get(circuitId);
  if (!state) return null;

  return {
    isOpen: state.isOpen,
    failures: state.failures,
    lastFailure: state.lastFailure,
  };
}

/**
 * Reset a circuit breaker
 */
export function resetCircuitBreaker(circuitId: string): void {
  circuitBreakers.delete(circuitId);
}

/**
 * Debounced async function with retry
 *
 * Ensures only the latest call is executed after the debounce period.
 */
export function createDebouncedRetry<T, Args extends unknown[]>(
  fn: (...args: Args) => Promise<T>,
  debounceMs: number,
  retryOptions: RetryOptions = {}
): {
  execute: (...args: Args) => Promise<AsyncResult<T>>;
  cancel: () => void;
} {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingPromise: Promise<AsyncResult<T>> | null = null;
  let resolvePending: ((result: AsyncResult<T>) => void) | null = null;

  const cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  const execute = (...args: Args): Promise<AsyncResult<T>> => {
    cancel();

    // If there's a pending promise, we'll resolve it with the new result
    if (!pendingPromise) {
      pendingPromise = new Promise<AsyncResult<T>>((resolve) => {
        resolvePending = resolve;
      });
    }

    timeoutId = setTimeout(async () => {
      const result = await withRetry(() => fn(...args), retryOptions);
      resolvePending?.(result);
      pendingPromise = null;
      resolvePending = null;
    }, debounceMs);

    return pendingPromise;
  };

  return { execute, cancel };
}

/**
 * Helper to create a fetch with retry
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retryOptions?: RetryOptions
): Promise<AsyncResult<Response>> {
  return withRetry(
    async () => {
      const response = await fetch(url, init);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    },
    retryOptions
  );
}

/**
 * Helper to create a JSON fetch with retry
 */
export async function fetchJsonWithRetry<T>(
  url: string,
  init?: RequestInit,
  retryOptions?: RetryOptions
): Promise<AsyncResult<T>> {
  return withRetry(
    async () => {
      const response = await fetch(url, init);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response.json() as Promise<T>;
    },
    retryOptions
  );
}
