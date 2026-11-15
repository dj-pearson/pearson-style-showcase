/**
 * Fetch with a deadline, safe retries and errors that keep the response.
 *
 * - One deadline per attempt (default 30s) that covers the headers AND the
 *   body. The timer stays armed until the body has been read, cancelled or
 *   has failed, so a server that sends headers and then stalls cannot hang
 *   the caller.
 * - Retries are only automatic for idempotent requests (GET, HEAD, OPTIONS
 *   by default). A POST/PUT/PATCH/DELETE never retries after a timeout or a
 *   network error, because the server may already have done the work (and
 *   billed for it). It retries on 429/503/529 only when the caller sets
 *   `retryOnRejected`, since those statuses mean the request was refused
 *   before it ran.
 * - The previous response body is cancelled before a retry so the connection
 *   is released, and Retry-After (seconds or HTTP date) is honoured up to
 *   `maxRetryAfterMs`. A longer Retry-After ends the retries early.
 * - When retries run out on a retryable status, the last Response is returned
 *   so the caller can read its status and body. fetchJsonWithTimeout turns
 *   any non-2xx into a FetchHttpError carrying status and a truncated body.
 */

export interface FetchWithTimeoutOptions {
  /** Deadline per attempt in milliseconds, covering headers and body (default: 30000) */
  timeoutMs?: number;
  /** Total number of attempts, including the first one (default: 3) */
  maxRetries?: number;
  /** Base delay between retries in ms, doubled each attempt (default: 1000) */
  retryBaseDelayMs?: number;
  /** Statuses that trigger a retry for idempotent requests (default: [408, 429, 500, 502, 503, 504]) */
  retryableStatuses?: number[];
  /**
   * Whether the request is safe to repeat. Defaults to true for GET, HEAD and
   * OPTIONS and false for everything else.
   */
  idempotent?: boolean;
  /**
   * Non-idempotent requests only: retry when the server answers 429, 503 or
   * 529, which mean the request was rejected before it was processed.
   * Default false.
   */
  retryOnRejected?: boolean;
  /** Longest Retry-After to wait for; a longer one stops retrying (default: 30000) */
  maxRetryAfterMs?: number;
  /** Label for log lines. Never put secrets in it. */
  label?: string;
}

export interface FetchError {
  error: string;
  code: string;
  status: number;
}

const DEFAULT_RETRYABLE_STATUSES = [408, 429, 500, 502, 503, 504];
/** Statuses that mean the server refused the request without running it. */
const REJECTED_STATUSES = [429, 503, 529];
const IDEMPOTENT_METHODS = ['GET', 'HEAD', 'OPTIONS'];
const NULL_BODY_STATUSES = [101, 103, 204, 205, 304];
const BODY_SNIPPET_CHARS = 500;

export class FetchTimeoutError extends Error {
  timeoutMs: number;
  constructor(message: string, timeoutMs: number) {
    super(message);
    this.name = 'FetchTimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/** A non-2xx response, with its status and the first part of its body. */
export class FetchHttpError extends Error {
  status: number;
  body: string;
  constructor(label: string, status: number, body: string) {
    super(`[${label}] HTTP ${status}${body ? `: ${body}` : ''}`);
    this.name = 'FetchHttpError';
    this.status = status;
    this.body = body;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncate(text: string, max = BODY_SNIPPET_CHARS): string {
  return text.length > max ? `${text.slice(0, max)}...` : text;
}

/**
 * Parse a Retry-After header value into milliseconds from `now`.
 * Accepts delta-seconds ("120") or an HTTP date. Returns null when absent or
 * unparseable; a date in the past yields 0.
 */
export function parseRetryAfter(value: string | null, now: number = Date.now()): number | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return Number(trimmed) * 1000;
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - now);
}

/** Read up to `max` characters of a response body without throwing. */
export async function readBodySnippet(
  response: Response,
  max = BODY_SNIPPET_CHARS
): Promise<string> {
  try {
    return truncate(await response.text(), max);
  } catch {
    return '';
  }
}

/**
 * One attempt. The returned Response's body is wrapped so the deadline keeps
 * running until the caller finishes reading it.
 */
async function attemptFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  label: string
): Promise<Response> {
  const controller = new AbortController();
  const timeoutError = new FetchTimeoutError(
    `[${label}] Request timed out after ${timeoutMs}ms`,
    timeoutMs
  );
  const timer = setTimeout(() => controller.abort(timeoutError), timeoutMs);

  const callerSignal = init.signal;
  const onCallerAbort = () => controller.abort(callerSignal?.reason);
  if (callerSignal) {
    if (callerSignal.aborted) onCallerAbort();
    else callerSignal.addEventListener('abort', onCallerAbort, { once: true });
  }

  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onCallerAbort);
  };
  const timedOut = () => controller.signal.aborted && controller.signal.reason === timeoutError;

  let response: Response;
  try {
    response = await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    settle();
    if (timedOut()) throw timeoutError;
    throw err;
  }

  if (!response.body || NULL_BODY_STATUSES.includes(response.status)) {
    settle();
    return response;
  }

  const reader = response.body.getReader();
  const body = new ReadableStream<Uint8Array>({
    async pull(streamController) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          settle();
          streamController.close();
        } else {
          streamController.enqueue(value);
        }
      } catch (err) {
        settle();
        streamController.error(timedOut() ? timeoutError : err);
      }
    },
    async cancel(reason) {
      settle();
      await reader.cancel(reason).catch(() => {});
    },
  });

  const wrapped = new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
  Object.defineProperty(wrapped, 'url', { value: response.url });
  Object.defineProperty(wrapped, 'redirected', { value: response.redirected });
  return wrapped;
}

/**
 * Fetch with a deadline and retry policy (see the module comment).
 *
 * Resolves with the Response on success, on a non-retryable status, or with
 * the last Response when retries on a retryable status run out. Rejects with
 * FetchTimeoutError or the network error when the final attempt (or any
 * attempt of a non-idempotent request) fails without a response.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  options: FetchWithTimeoutOptions = {}
): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  const {
    timeoutMs = 30_000,
    maxRetries = 3,
    retryBaseDelayMs = 1_000,
    retryableStatuses = DEFAULT_RETRYABLE_STATUSES,
    idempotent = IDEMPOTENT_METHODS.includes(method),
    retryOnRejected = false,
    maxRetryAfterMs = 30_000,
    label = 'fetch',
  } = options;
  const attempts = Math.max(1, maxRetries);

  for (let attempt = 1; ; attempt++) {
    const isLast = attempt >= attempts;
    let response: Response;

    try {
      response = await attemptFetch(url, init, timeoutMs, label);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isLast || !idempotent || init.signal?.aborted) {
        console.error(`[${label}] Attempt ${attempt}/${attempts} failed, giving up: ${message}`);
        throw err;
      }
      console.warn(`[${label}] Attempt ${attempt}/${attempts} failed: ${message}. Retrying...`);
      await sleep(retryBaseDelayMs * Math.pow(2, attempt - 1));
      continue;
    }

    const retryable = idempotent
      ? retryableStatuses.includes(response.status)
      : retryOnRejected && REJECTED_STATUSES.includes(response.status);
    if (!retryable) return response;

    if (isLast) {
      console.error(
        `[${label}] Attempt ${attempt}/${attempts} returned ${response.status}, giving up`
      );
      return response;
    }

    const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
    if (retryAfter !== null && retryAfter > maxRetryAfterMs) {
      console.error(
        `[${label}] ${response.status} with Retry-After ${Math.round(retryAfter / 1000)}s exceeds ${maxRetryAfterMs / 1000}s, giving up`
      );
      return response;
    }

    // Release the connection before waiting; the body of a response we are
    // about to discard is never needed.
    await response.body?.cancel().catch(() => {});
    const delay = Math.max(retryBaseDelayMs * Math.pow(2, attempt - 1), retryAfter ?? 0);
    console.warn(
      `[${label}] Attempt ${attempt}/${attempts} returned ${response.status}. Retrying in ${delay}ms...`
    );
    await sleep(delay);
  }
}

export interface FetchJsonResult<T> {
  status: number;
  headers: Headers;
  data: T;
}

/**
 * fetchWithTimeout, then read and parse the JSON body under the same
 * per-attempt deadline. Throws FetchHttpError (status + truncated body) for a
 * non-2xx response or a body that is not JSON, and FetchTimeoutError when the
 * headers or body do not arrive in time.
 */
export async function fetchJsonWithTimeout<T = unknown>(
  url: string,
  init: RequestInit = {},
  options: FetchWithTimeoutOptions = {}
): Promise<FetchJsonResult<T>> {
  const label = options.label ?? 'fetch';
  const response = await fetchWithTimeout(url, init, options);
  const text = await response.text();
  if (!response.ok) throw new FetchHttpError(label, response.status, truncate(text));
  try {
    return { status: response.status, headers: response.headers, data: JSON.parse(text) as T };
  } catch {
    throw new FetchHttpError(label, response.status, `invalid JSON: ${truncate(text, 200)}`);
  }
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
