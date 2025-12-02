/**
 * CSRF Protection for Supabase Edge Functions
 *
 * Implements multi-layered CSRF protection:
 * 1. Origin/Referer validation
 * 2. Custom CSRF header validation
 * 3. Token timestamp verification
 *
 * Usage:
 *   import { validateCSRF, CSRFError } from "../_shared/csrf-protection.ts";
 *
 *   const csrfResult = validateCSRF(req, ALLOWED_ORIGINS);
 *   if (!csrfResult.valid) {
 *     return csrfResult.response;
 *   }
 */

import { getCorsHeaders, ALLOWED_ORIGINS } from "./cors.ts";

const CSRF_HEADER_NAME = "x-csrf-token";
const MAX_TOKEN_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours (matching client)

// Methods that require CSRF protection
const PROTECTED_METHODS = ["POST", "PUT", "DELETE", "PATCH"];

/**
 * CSRF validation result
 */
interface CSRFValidationResult {
  valid: boolean;
  error?: string;
  response?: Response;
}

/**
 * Custom error for CSRF failures
 */
export class CSRFError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CSRFError";
  }
}

/**
 * Validate Origin header against allowed origins
 */
function validateOrigin(
  origin: string | null,
  allowedOrigins: string[]
): { valid: boolean; error?: string } {
  if (!origin) {
    return { valid: false, error: "Missing Origin header" };
  }

  // Normalize origin (remove trailing slash)
  const normalizedOrigin = origin.replace(/\/$/, "");

  // Check against allowed origins
  const isAllowed = allowedOrigins.some((allowed) => {
    const normalizedAllowed = allowed.replace(/\/$/, "");
    return normalizedOrigin === normalizedAllowed;
  });

  if (!isAllowed) {
    return { valid: false, error: `Origin not allowed: ${origin}` };
  }

  return { valid: true };
}

/**
 * Validate Referer header as a fallback
 */
function validateReferer(
  referer: string | null,
  allowedOrigins: string[]
): { valid: boolean; error?: string } {
  if (!referer) {
    return { valid: false, error: "Missing Referer header" };
  }

  try {
    const refererUrl = new URL(referer);
    const refererOrigin = refererUrl.origin;

    return validateOrigin(refererOrigin, allowedOrigins);
  } catch {
    return { valid: false, error: "Invalid Referer header" };
  }
}

/**
 * Validate CSRF token format and timestamp
 */
function validateCSRFToken(token: string | null): { valid: boolean; error?: string } {
  if (!token) {
    return { valid: false, error: "Missing CSRF token" };
  }

  // Token format: timestamp.hash
  const parts = token.split(".");
  if (parts.length !== 2) {
    return { valid: false, error: "Invalid CSRF token format" };
  }

  const [timestampPart, hashPart] = parts;

  // Validate timestamp
  const timestamp = parseInt(timestampPart, 36);
  if (isNaN(timestamp)) {
    return { valid: false, error: "Invalid CSRF token timestamp" };
  }

  // Check token age
  const tokenAge = Date.now() - timestamp;
  if (tokenAge > MAX_TOKEN_AGE_MS) {
    return { valid: false, error: "CSRF token expired" };
  }

  // Token can't be from the future (with 1 minute tolerance for clock skew)
  if (tokenAge < -60000) {
    return { valid: false, error: "CSRF token timestamp invalid" };
  }

  // Validate hash part exists and has reasonable length
  if (!hashPart || hashPart.length < 20) {
    return { valid: false, error: "Invalid CSRF token hash" };
  }

  return { valid: true };
}

/**
 * Main CSRF validation function
 */
export function validateCSRF(
  req: Request,
  allowedOrigins: string[] = ALLOWED_ORIGINS
): CSRFValidationResult {
  const method = req.method.toUpperCase();

  // Skip validation for safe methods
  if (!PROTECTED_METHODS.includes(method)) {
    return { valid: true };
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const csrfToken = req.headers.get(CSRF_HEADER_NAME);

  // Step 1: Validate Origin (primary check)
  const originResult = validateOrigin(origin, allowedOrigins);

  if (!originResult.valid) {
    // Fall back to Referer validation
    const refererResult = validateReferer(referer, allowedOrigins);

    if (!refererResult.valid) {
      console.error(`CSRF Origin validation failed: ${originResult.error}`);
      console.error(`CSRF Referer validation failed: ${refererResult.error}`);

      return {
        valid: false,
        error: "Origin validation failed",
        response: new Response(
          JSON.stringify({
            error: "Forbidden",
            message: "Request origin not allowed",
          }),
          {
            status: 403,
            headers: {
              ...getCorsHeaders(origin),
              "Content-Type": "application/json",
            },
          }
        ),
      };
    }
  }

  // Step 2: Validate CSRF token
  const tokenResult = validateCSRFToken(csrfToken);

  if (!tokenResult.valid) {
    console.error(`CSRF Token validation failed: ${tokenResult.error}`);

    return {
      valid: false,
      error: tokenResult.error,
      response: new Response(
        JSON.stringify({
          error: "Forbidden",
          message: "Invalid or missing CSRF token",
          code: "CSRF_VALIDATION_FAILED",
        }),
        {
          status: 403,
          headers: {
            ...getCorsHeaders(origin),
            "Content-Type": "application/json",
          },
        }
      ),
    };
  }

  return { valid: true };
}

/**
 * Middleware-style CSRF validation
 * Returns null if validation passes, Response if it fails
 */
export function csrfMiddleware(
  req: Request,
  allowedOrigins: string[] = ALLOWED_ORIGINS
): Response | null {
  const result = validateCSRF(req, allowedOrigins);

  if (!result.valid && result.response) {
    return result.response;
  }

  return null;
}

/**
 * Check if request method requires CSRF protection
 */
export function requiresCSRFProtection(method: string): boolean {
  return PROTECTED_METHODS.includes(method.toUpperCase());
}

/**
 * Get CSRF header name (for client-side reference)
 */
export function getCSRFHeaderName(): string {
  return CSRF_HEADER_NAME;
}

/**
 * Create a CSRF-protected handler wrapper
 */
export function withCSRFProtection(
  handler: (req: Request) => Promise<Response>,
  allowedOrigins: string[] = ALLOWED_ORIGINS
): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    // Skip for OPTIONS (preflight)
    if (req.method === "OPTIONS") {
      return handler(req);
    }

    const csrfError = csrfMiddleware(req, allowedOrigins);
    if (csrfError) {
      return csrfError;
    }

    return handler(req);
  };
}
