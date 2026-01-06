import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  withRetry,
  withRetryAll,
  isRetryableError,
  categorizeError,
  withCircuitBreaker,
  resetCircuitBreaker,
  getCircuitBreakerStatus,
  fetchWithRetry,
} from '../async-utils';

// Mock error tracking
vi.mock('@/lib/error-tracking', () => ({
  captureException: vi.fn(),
}));

describe('Async Utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('isRetryableError', () => {
    it('should return true for network errors', () => {
      const error = new TypeError('Failed to fetch');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for rate limiting (429)', () => {
      const error = new Error('HTTP 429: Too Many Requests');
      expect(isRetryableError(error)).toBe(true);
    });

    it('should return true for server errors (5xx)', () => {
      expect(isRetryableError(new Error('HTTP 500: Internal Server Error'))).toBe(true);
      expect(isRetryableError(new Error('HTTP 502: Bad Gateway'))).toBe(true);
      expect(isRetryableError(new Error('HTTP 503: Service Unavailable'))).toBe(true);
      expect(isRetryableError(new Error('HTTP 504: Gateway Timeout'))).toBe(true);
    });

    it('should return false for client errors (4xx)', () => {
      expect(isRetryableError(new Error('HTTP 400: Bad Request'))).toBe(false);
      expect(isRetryableError(new Error('HTTP 401: Unauthorized'))).toBe(false);
      expect(isRetryableError(new Error('HTTP 403: Forbidden'))).toBe(false);
      expect(isRetryableError(new Error('HTTP 404: Not Found'))).toBe(false);
    });

    it('should return false for abort errors', () => {
      const error = new DOMException('Operation aborted', 'AbortError');
      expect(isRetryableError(error)).toBe(false);
    });

    it('should return false for null/undefined', () => {
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
    });
  });

  describe('categorizeError', () => {
    it('should categorize network errors', () => {
      const error = new TypeError('Failed to fetch');
      expect(categorizeError(error)).toBe('network');
    });

    it('should categorize timeout errors', () => {
      const error = new Error('Request timeout');
      expect(categorizeError(error)).toBe('timeout');
    });

    it('should categorize rate limit errors', () => {
      const error = new Error('HTTP 429: Too Many Requests');
      expect(categorizeError(error)).toBe('rate_limit');
    });

    it('should categorize server errors', () => {
      const error = new Error('HTTP 500: Internal Server Error');
      expect(categorizeError(error)).toBe('server_error');
    });

    it('should return unknown for unrecognized errors', () => {
      const error = new Error('Something went wrong');
      expect(categorizeError(error)).toBe('unknown');
    });
  });

  describe('withRetry', () => {
    it('should succeed on first attempt if no error', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const resultPromise = withRetry(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('HTTP 500'))
        .mockRejectedValueOnce(new Error('HTTP 500'))
        .mockResolvedValue('success');

      const resultPromise = withRetry(fn, { initialDelay: 100 });

      // Fast-forward through retries
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
      expect(result.attempts).toBe(3);
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('HTTP 404: Not Found'));

      const resultPromise = withRetry(fn);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(1);
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries exceeded', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('HTTP 500'));

      const resultPromise = withRetry(fn, { maxRetries: 2, initialDelay: 100 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.attempts).toBe(3); // Initial + 2 retries
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('should call onRetry callback', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('HTTP 500'))
        .mockResolvedValue('success');
      const onRetry = vi.fn();

      const resultPromise = withRetry(fn, { initialDelay: 100, onRetry });
      await vi.runAllTimersAsync();
      await resultPromise;

      expect(onRetry).toHaveBeenCalledTimes(1);
      expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error), expect.any(Number));
    });

    it('should respect custom isRetryable function', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('Custom error'));
      const isRetryable = vi.fn().mockReturnValue(false);

      const resultPromise = withRetry(fn, { isRetryable, initialDelay: 100 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(isRetryable).toHaveBeenCalled();
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should handle abort signal', async () => {
      const controller = new AbortController();
      const fn = vi.fn().mockRejectedValue(new Error('HTTP 500'));

      const resultPromise = withRetry(fn, {
        signal: controller.signal,
        initialDelay: 1000,
      });

      // Abort after first attempt
      controller.abort();
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('withRetryAll', () => {
    it('should execute all functions with retry', async () => {
      const fns = [
        vi.fn().mockResolvedValue('a'),
        vi.fn().mockResolvedValue('b'),
        vi.fn().mockResolvedValue('c'),
      ];

      const resultsPromise = withRetryAll(fns);
      await vi.runAllTimersAsync();
      const results = await resultsPromise;

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success)).toBe(true);
      expect(results.map(r => r.data)).toEqual(['a', 'b', 'c']);
    });

    it('should handle mixed success and failure', async () => {
      const fns = [
        vi.fn().mockResolvedValue('success'),
        vi.fn().mockRejectedValue(new Error('HTTP 404')),
      ];

      const resultsPromise = withRetryAll(fns);
      await vi.runAllTimersAsync();
      const results = await resultsPromise;

      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
    });
  });

  describe('withCircuitBreaker', () => {
    const circuitId = 'test-circuit';

    beforeEach(() => {
      resetCircuitBreaker(circuitId);
    });

    it('should work normally when circuit is closed', async () => {
      const fn = vi.fn().mockResolvedValue('success');

      const resultPromise = withCircuitBreaker(fn, { circuitId });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data).toBe('success');
    });

    it('should open circuit after failure threshold', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('HTTP 500'));

      // Fail 5 times to open circuit
      for (let i = 0; i < 5; i++) {
        const resultPromise = withCircuitBreaker(fn, {
          circuitId,
          failureThreshold: 5,
          maxRetries: 0,
        });
        await vi.runAllTimersAsync();
        await resultPromise;
      }

      const status = getCircuitBreakerStatus(circuitId);
      expect(status?.isOpen).toBe(true);
      expect(status?.failures).toBe(5);
    });

    it('should reject immediately when circuit is open', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('HTTP 500'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        const resultPromise = withCircuitBreaker(fn, {
          circuitId,
          failureThreshold: 5,
          resetTimeout: 60000, // Long timeout to ensure circuit stays open
          maxRetries: 0,
        });
        await vi.runAllTimersAsync();
        await resultPromise;
      }

      // Next call should be rejected immediately
      fn.mockClear();
      const resultPromise = withCircuitBreaker(fn, {
        circuitId,
        failureThreshold: 5,
        resetTimeout: 60000, // Same long timeout
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Circuit breaker open');
      expect(fn).not.toHaveBeenCalled();
    });

    it('should attempt to close circuit after reset timeout', async () => {
      const fn = vi.fn()
        .mockRejectedValue(new Error('HTTP 500'));

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        const resultPromise = withCircuitBreaker(fn, {
          circuitId,
          failureThreshold: 5,
          resetTimeout: 1000,
          maxRetries: 0,
        });
        await vi.runAllTimersAsync();
        await resultPromise;
      }

      // Advance time past reset timeout
      vi.advanceTimersByTime(1500);

      // Now the function should be called again (half-open state)
      fn.mockClear();
      fn.mockResolvedValue('success');

      const resultPromise = withCircuitBreaker(fn, {
        circuitId,
        failureThreshold: 5,
        resetTimeout: 1000,
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(fn).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should reset failures on success', async () => {
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('HTTP 500'))
        .mockRejectedValueOnce(new Error('HTTP 500'))
        .mockResolvedValue('success');

      // Fail twice
      for (let i = 0; i < 2; i++) {
        const resultPromise = withCircuitBreaker(fn, {
          circuitId,
          failureThreshold: 5,
          maxRetries: 0,
        });
        await vi.runAllTimersAsync();
        await resultPromise;
      }

      // Succeed
      const resultPromise = withCircuitBreaker(fn, {
        circuitId,
        failureThreshold: 5,
        maxRetries: 0,
      });
      await vi.runAllTimersAsync();
      await resultPromise;

      const status = getCircuitBreakerStatus(circuitId);
      expect(status?.failures).toBe(0);
    });
  });

  describe('fetchWithRetry', () => {
    const originalFetch = global.fetch;

    beforeEach(() => {
      global.fetch = vi.fn();
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('should return success for OK response', async () => {
      const mockResponse = { ok: true, status: 200 };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue(mockResponse);

      const resultPromise = fetchWithRetry('/api/test');
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockResponse);
    });

    it('should retry on server errors', async () => {
      (global.fetch as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error' })
        .mockResolvedValueOnce({ ok: true, status: 200 });

      const resultPromise = fetchWithRetry('/api/test', undefined, { initialDelay: 100 });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });
});
