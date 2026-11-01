/**
 * Pure helpers for require-admin.
 *
 * Extracted so the security-relevant decisions (bearer parsing and the
 * constant-time token compare) can be unit-tested without loading
 * require-admin.ts, which imports Supabase over a URL this sandbox blocks.
 * Same rationale as _shared/auth-helpers.ts.
 */

/**
 * Pull the token out of an Authorization header.
 * Returns null when the header is absent, malformed or carries no token.
 */
export function parseBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  return token.length > 0 ? token : null;
}

/**
 * Compare two secrets without leaking their contents through timing.
 * Length is not secret here (the service role key length is public), so an
 * early length check is fine; the per-character loop must not short-circuit.
 */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Error string returned (with HTTP 403) when an admin call arrives at aal1. */
export const MFA_REQUIRED_ERROR = 'mfa_required';

/**
 * Decode the payload segment of a JWT without verifying it.
 *
 * Only call this on a token that has already been validated (for example by
 * supabase.auth.getUser(token)); the signature is not checked here. Returns
 * null for anything that is not a three-part token with a JSON object payload.
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const payload = JSON.parse(new TextDecoder().decode(bytes));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * True when a validated access token was issued after a second factor
 * (Supabase sets aal to 'aal2' once an MFA challenge has been verified).
 */
export function tokenHasAal2(token: string): boolean {
  return decodeJwtPayload(token)?.aal === 'aal2';
}
