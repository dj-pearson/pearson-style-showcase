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
