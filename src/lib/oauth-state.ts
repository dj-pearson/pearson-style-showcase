/**
 * OAuth State Parameter Utilities
 *
 * Provides CSRF protection for OAuth flows through state parameter validation.
 * State is cryptographically bound to:
 * - A CSRF token (from csrf.ts)
 * - The OAuth provider name
 * - The intended redirect URL
 *
 * This prevents state interception, replay, and cross-provider attacks.
 */

import { getCSRFToken } from '@/lib/csrf';
import { logger } from '@/lib/logger';

// Storage keys
const OAUTH_STATE_KEY = 'oauth_state';
const OAUTH_STATE_META_KEY = 'oauth_state_meta';
const OAUTH_STATE_EXPIRY_KEY = 'oauth_state_expiry';

// State expiry time (30 minutes for OAuth flows - reduced from general CSRF 4-hour window)
const STATE_EXPIRY_MS = 30 * 60 * 1000;
// Grace period after verification for slow redirects (reduced from 5 min)
const STATE_GRACE_MS = 30 * 1000; // 30 seconds
// Key to track used states
const OAUTH_STATE_USED_KEY = 'oauth_state_used';

interface OAuthStateMeta {
  provider: string;
  redirectTo: string;
  csrfToken: string;
  createdAt: number;
}

/**
 * Generate a cryptographically secure random string
 */
function generateRandomString(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  const base64 = btoa(String.fromCharCode(...randomBytes));
  return base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Generate an HMAC-like binding hash that ties the state to provider + redirect + CSRF token
 */
async function generateBindingHash(
  stateRandom: string,
  provider: string,
  redirectTo: string,
  csrfToken: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${stateRandom}|${provider}|${redirectTo}|${csrfToken}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const hashBase64 = btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return hashBase64;
}

/**
 * Generate an OAuth state parameter bound to provider and CSRF token.
 * The state encodes a random component + binding hash.
 */
export async function generateOAuthState(provider: string, redirectTo: string = '/'): Promise<string> {
  const randomPart = generateRandomString();
  const csrfToken = await getCSRFToken();
  const bindingHash = await generateBindingHash(randomPart, provider, redirectTo, csrfToken);

  // State format: random.hash (the hash binds it to provider/redirect/csrf)
  return `${randomPart}.${bindingHash}`;
}

/**
 * Store OAuth state in sessionStorage with metadata for later verification
 */
export async function storeOAuthState(state: string, provider: string, redirectTo: string = '/'): Promise<void> {
  try {
    const csrfToken = await getCSRFToken();
    const expiry = Date.now() + STATE_EXPIRY_MS;
    const meta: OAuthStateMeta = {
      provider,
      redirectTo,
      csrfToken,
      createdAt: Date.now(),
    };

    sessionStorage.setItem(OAUTH_STATE_KEY, state);
    sessionStorage.setItem(OAUTH_STATE_META_KEY, JSON.stringify(meta));
    sessionStorage.setItem(OAUTH_STATE_EXPIRY_KEY, expiry.toString());
  } catch (error) {
    logger.error('Failed to store OAuth state:', error);
  }
}

/**
 * Retrieve stored OAuth state and metadata.
 * Implements one-time-use: state is marked as "used" immediately on first retrieval,
 * with a 30-second grace period for slow redirects before full cleanup.
 */
function retrieveOAuthStateAndMeta(): { state: string | null; meta: OAuthStateMeta | null } {
  try {
    // Check if state was already used (replay prevention)
    const usedAt = sessionStorage.getItem(OAUTH_STATE_USED_KEY);
    if (usedAt) {
      const usedTimestamp = parseInt(usedAt, 10);
      if (Date.now() - usedTimestamp > STATE_GRACE_MS) {
        // Grace period expired - reject replay
        logger.warn('OAuth state replay rejected (already used)');
        clearStoredOAuthState();
        return { state: null, meta: null };
      }
      // Within grace period - allow (handles slow redirect double-calls)
    }

    const state = sessionStorage.getItem(OAUTH_STATE_KEY);
    const metaStr = sessionStorage.getItem(OAUTH_STATE_META_KEY);
    const expiryStr = sessionStorage.getItem(OAUTH_STATE_EXPIRY_KEY);

    if (!state || !metaStr || !expiryStr) {
      clearStoredOAuthState();
      return { state: null, meta: null };
    }

    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || Date.now() > expiry) {
      logger.warn('OAuth state expired');
      clearStoredOAuthState();
      return { state: null, meta: null };
    }

    const meta: OAuthStateMeta = JSON.parse(metaStr);

    // Mark state as used immediately (one-time-use)
    if (!usedAt) {
      sessionStorage.setItem(OAUTH_STATE_USED_KEY, Date.now().toString());
    }

    // Schedule full cleanup after grace period
    setTimeout(() => {
      clearStoredOAuthState();
    }, STATE_GRACE_MS);

    return { state, meta };
  } catch (error) {
    logger.error('Failed to retrieve OAuth state:', error);
    clearStoredOAuthState();
    return { state: null, meta: null };
  }
}

/**
 * Clear stored OAuth state
 */
function clearStoredOAuthState(): void {
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(OAUTH_STATE_META_KEY);
  sessionStorage.removeItem(OAUTH_STATE_EXPIRY_KEY);
  sessionStorage.removeItem(OAUTH_STATE_USED_KEY);
}

/**
 * Timing-safe string comparison
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * Verify OAuth state parameter matches stored state AND is bound to the correct provider.
 * Validates:
 * 1. State matches stored value (timing-safe comparison)
 * 2. Provider matches what was used to generate the state
 * 3. Redirect URL matches what was intended
 * 4. Binding hash is valid (state is cryptographically bound to provider + CSRF)
 */
/**
 * Verify OAuth state parameter matches stored state AND is bound to the correct provider.
 * When provider is specified, validates full binding (provider + redirect + CSRF hash).
 * When provider is omitted (legacy flow), falls back to timing-safe state comparison only.
 */
export async function verifyOAuthState(
  receivedState: string | null,
  provider?: string,
  redirectTo?: string
): Promise<{ valid: boolean; error?: string }> {
  if (!receivedState) {
    return { valid: false, error: 'No state parameter in callback' };
  }

  const { state: storedState, meta } = retrieveOAuthStateAndMeta();

  if (!storedState) {
    return { valid: false, error: 'No stored state found or state expired' };
  }

  // Verify state matches (timing-safe)
  if (!timingSafeEqual(receivedState, storedState)) {
    clearStoredOAuthState();
    return { valid: false, error: 'State parameter mismatch' };
  }

  // If metadata is available and provider is specified, verify full binding
  if (meta && provider) {
    // Verify provider binding - prevents cross-provider state reuse
    if (meta.provider !== provider) {
      logger.warn('OAuth state provider mismatch', {
        expected: meta.provider,
        received: provider,
      });
      clearStoredOAuthState();
      return { valid: false, error: 'State parameter bound to different provider' };
    }

    // Verify redirect URL binding (if specified)
    const expectedRedirect = redirectTo || meta.redirectTo;
    if (redirectTo && meta.redirectTo !== expectedRedirect) {
      logger.warn('OAuth state redirect mismatch', {
        expected: meta.redirectTo,
        received: redirectTo,
      });
      clearStoredOAuthState();
      return { valid: false, error: 'State parameter bound to different redirect' };
    }

    // Verify the binding hash integrity
    const parts = receivedState.split('.');
    if (parts.length === 2) {
      const [randomPart, receivedHash] = parts;
      const expectedHash = await generateBindingHash(randomPart, meta.provider, meta.redirectTo, meta.csrfToken);

      if (!timingSafeEqual(receivedHash, expectedHash)) {
        clearStoredOAuthState();
        return { valid: false, error: 'State binding verification failed' };
      }
    }
  }

  // Clear state after successful verification (prevents replay)
  clearStoredOAuthState();

  return { valid: true };
}

/**
 * Generate and store OAuth state, returning the state for use in OAuth request.
 * Convenience function combining generation and storage.
 * State is bound to the specified provider and redirect URL.
 */
export async function createOAuthState(provider: string, redirectTo: string = '/'): Promise<string> {
  const state = await generateOAuthState(provider, redirectTo);
  await storeOAuthState(state, provider, redirectTo);
  return state;
}

/**
 * Legacy compatibility: retrieve stored state (for existing code that uses this pattern)
 * @deprecated Use verifyOAuthState instead for proper provider binding verification
 */
export function retrieveOAuthState(): string | null {
  const { state } = retrieveOAuthStateAndMeta();
  return state;
}
