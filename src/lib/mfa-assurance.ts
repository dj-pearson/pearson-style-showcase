/**
 * Helpers for the server-side MFA gate.
 *
 * Admin edge functions (via supabase/functions/_shared/require-admin.ts and
 * admin-auth's 'me' action) refuse aal1 tokens with 403 {error: 'mfa_required'}.
 * These helpers let the client recognise that answer and avoid trusting cached
 * admin state for a session that has not passed MFA.
 */

/** Error string the admin edge functions return for an aal1 session. */
export const MFA_REQUIRED_ERROR = 'mfa_required';

/**
 * Read the `aal` claim from a Supabase access token. The token is not
 * verified here; this is only a hint for routing, the server enforces it.
 */
export function getJwtAal(accessToken: string | null | undefined): string | null {
  if (!accessToken) return null;
  const parts = accessToken.split('.');
  if (parts.length !== 3 || !parts[1]) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0));
    const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;
    const aal = (payload as Record<string, unknown>).aal;
    return typeof aal === 'string' ? aal : null;
  } catch {
    return null;
  }
}

/** True when the access token says the session passed an MFA challenge. */
export function isAal2Token(accessToken: string | null | undefined): boolean {
  return getJwtAal(accessToken) === 'aal2';
}

/**
 * True when an edge function result says the caller must complete MFA first.
 * Accepts the Error from invokeEdgeFunction or a response body.
 */
export function isMfaRequiredError(errorOrData: unknown): boolean {
  if (!errorOrData) return false;
  if (errorOrData instanceof Error) return errorOrData.message === MFA_REQUIRED_ERROR;
  if (typeof errorOrData === 'object') {
    return (errorOrData as { error?: unknown }).error === MFA_REQUIRED_ERROR;
  }
  return false;
}
