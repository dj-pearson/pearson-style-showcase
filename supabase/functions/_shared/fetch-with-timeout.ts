/**
 * Fetch with Timeout, Retry, and Structured Error Responses
 *
 * Provides a robust fetch wrapper for edge functions making external API calls.
 * Features:
 * - Configurable timeout (default 30s)
 * - Retry with exponential backoff (default 3 attempts)
 * - Structured JSON error responses
 * - Production-safe logging
 */

export interface FetchWithTimeoutOptions {
  /** Timeout in milliseconds (default: 30000) */
  timeoutMs?: number;
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay between retries in ms, doubled each attempt (default: 1000) */
  retryBaseDelayMs?: number;
  /** HTTP status codes that should trigger a retry (default: [408, 429, 500, 502, 503, 504]) */
  retryableStatuses?: number[];
  /** Label for logging context */
  label?: string;
}

export interface FetchError {
  error: string;
  code: string;
  status: number;
}

const DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithAbort(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  label: string
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
    });
    return response;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new FetchTimeoutError(
        `[${label}] Request timed out after ${timeoutMs}ms`,
        timeoutMs
      );
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export class FetchTimeoutError extends Error {
  timeoutMs: number;
  constructor(message: string, timeoutMs: number) {
    super(message);
    this.name = 'FetchTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Sleep for a given duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout and retry logic.
 *
 * Returns the Response on success.
 * Throws a structured error if all retries are exhausted.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const {
    timeoutMs = 30_000,
    maxRetries = 3,
    retryBaseDelayMs = 1_000,
    retryableStatuses = DEFAULT_RETRYABLE_STATUSES,
    label = 'fetch',
  } = options;

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithAbort(url, init, timeoutMs, label);

      // If the response is not retryable, return it (even if it's an error status)
      if (!retryableStatuses.includes(response.status)) {
        return response;
      }

      // Retryable status - log and retry
      console.warn(
        `[${label}] Attempt ${attempt}/${maxRetries} returned ${response.status}. Retrying...`
      );
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      console.warn(
        `[${label}] Attempt ${attempt}/${maxRetries} failed: ${err instanceof Error ? err.message : String(err)}`
      );
      lastError = err;
    }

    // Don't sleep after the last attempt
    if (attempt < maxRetries) {
      const delay = retryBaseDelayMs * Math.pow(2, attempt - 1);
      await sleep(delay);
    }
  }

  // All retries exhausted
  const errorMessage = lastError instanceof Error ? lastError.message : String(lastError);
  console.error(`[${label}] All ${maxRetries} attempts failed. Last error: ${errorMessage}`);

  throw lastError;
}

/**
 * Build a structured error response for edge function consumers
 */
export function structuredErrorResponse(
  error: string,
  code: string,
  status: number,
  corsHeaders: Record<string, string>
): Response {
  const body: FetchError = { error, code, status };
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
