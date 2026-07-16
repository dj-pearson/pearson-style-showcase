/**
 * Pure authentication helpers for admin-auth.
 *
 * Extracted so the security-relevant decisions (login input validation and the
 * rate-limit lockout threshold) can be unit-tested without loading the full
 * edge function, which imports Supabase over a URL this sandbox blocks.
 */

export const MAX_LOGIN_ATTEMPTS = 5;
export const LOGIN_LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes

export interface LoginInputResult {
  valid: boolean;
  error?: string;
}

/** Presence/type validation for a login payload (matches the handler's guard). */
export function validateLoginInput(email: unknown, password: unknown): LoginInputResult {
  if (
    typeof email !== 'string' ||
    email.trim().length === 0 ||
    typeof password !== 'string' ||
    password.length === 0
  ) {
    return { valid: false, error: 'Email and password are required' };
  }
  return { valid: true };
}

/** Basic email-format check (for defense-in-depth / diagnostics). */
export function isValidEmailFormat(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/** The lockout decision: locked out once failed attempts reach the max. */
export function isLockedOut(
  attemptCount: number,
  maxAttempts: number = MAX_LOGIN_ATTEMPTS
): boolean {
  return attemptCount >= maxAttempts;
}
