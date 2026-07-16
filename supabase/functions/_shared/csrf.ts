/**
 * Server-side CSRF validation for edge functions.
 *
 * The SPA uses a header-based CSRF token (x-csrf-token) combined with a strict
 * Origin allow-list — together these defend state-changing requests against
 * cross-site request forgery:
 *
 *  - A forged cross-site request from evil.example.com carries that Origin,
 *    which is not in the allow-list, so it is rejected.
 *  - The x-csrf-token header cannot be set cross-origin without the app's code,
 *    so its presence is required as defense in depth.
 *
 * Call validateCsrf() for state-changing methods (POST/PUT/PATCH/DELETE) in
 * sensitive functions (admin-auth, secure-vault, process-accounting-document).
 */
import { getAllowedOrigins } from './cors.ts';

const CSRF_HEADER = 'x-csrf-token';
const STATE_CHANGING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export interface CsrfResult {
  valid: boolean;
  reason?: 'origin_not_allowed' | 'missing_csrf_token';
}

/** Whether this request method mutates state and therefore needs CSRF checks. */
export function isStateChanging(method: string): boolean {
  return STATE_CHANGING.has(method.toUpperCase());
}

/**
 * Validate CSRF for a state-changing request. A present Origin must be in the
 * allow-list, and a non-trivial x-csrf-token header must be present.
 */
export function validateCsrf(req: Request): CsrfResult {
  const origin = req.headers.get('origin');
  // Browsers always send Origin on cross-site state-changing requests; a
  // present-but-disallowed Origin is the clearest forgery signal.
  if (origin && !getAllowedOrigins().includes(origin)) {
    return { valid: false, reason: 'origin_not_allowed' };
  }

  const token = req.headers.get(CSRF_HEADER);
  if (!token || token.trim().length < 16) {
    return { valid: false, reason: 'missing_csrf_token' };
  }

  return { valid: true };
}

export { CSRF_HEADER };
