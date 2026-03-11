/**
 * Error Normalizer for Edge Functions
 *
 * Provides generic, safe error messages to clients while logging
 * the real error details server-side only. Prevents information leakage
 * of stack traces, database details, API keys, and internal paths.
 */

/** Standard error codes returned to clients */
type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'VALIDATION_ERROR'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE'
  | 'TIMEOUT';

/** Mapping of error codes to generic, safe user-facing messages */
const ERROR_MESSAGES: Record<ErrorCode, string> = {
  BAD_REQUEST: 'The request was invalid. Please check your input and try again.',
  UNAUTHORIZED: 'Authentication is required. Please sign in and try again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  VALIDATION_ERROR: 'The provided data is invalid. Please check your input.',
  INTERNAL_ERROR: 'An unexpected error occurred. Please try again later.',
  SERVICE_UNAVAILABLE: 'The service is temporarily unavailable. Please try again later.',
  TIMEOUT: 'The request timed out. Please try again.',
};

/** HTTP status codes for each error code */
const ERROR_STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  RATE_LIMITED: 429,
  VALIDATION_ERROR: 422,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
  TIMEOUT: 504,
};

interface NormalizedErrorResponse {
  error: string;
  code: ErrorCode;
}

/**
 * Create a normalized error response that hides internal details.
 * Logs the real error server-side for debugging.
 *
 * @param code - The error classification code
 * @param internalError - The actual error (logged server-side only, never sent to client)
 * @param corsHeaders - CORS headers to include in response
 * @param customMessage - Optional custom user-facing message (must not contain sensitive info)
 */
export function normalizedErrorResponse(
  code: ErrorCode,
  internalError: unknown,
  corsHeaders: Record<string, string>,
  customMessage?: string
): Response {
  // Log the real error server-side for debugging
  console.error(`[${code}]`, internalError);

  const body: NormalizedErrorResponse = {
    error: customMessage || ERROR_MESSAGES[code],
    code,
  };

  return new Response(JSON.stringify(body), {
    status: ERROR_STATUS[code],
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Classify an error into an appropriate error code based on its characteristics.
 */
export function classifyError(error: unknown): ErrorCode {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();

    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) {
      return 'TIMEOUT';
    }
    if (msg.includes('rate limit') || msg.includes('too many')) {
      return 'RATE_LIMITED';
    }
    if (msg.includes('unauthorized') || msg.includes('auth') || msg.includes('token')) {
      return 'UNAUTHORIZED';
    }
    if (msg.includes('forbidden') || msg.includes('permission') || msg.includes('denied')) {
      return 'FORBIDDEN';
    }
    if (msg.includes('not found') || msg.includes('404')) {
      return 'NOT_FOUND';
    }
    if (msg.includes('validation') || msg.includes('invalid')) {
      return 'VALIDATION_ERROR';
    }
  }

  return 'INTERNAL_ERROR';
}
