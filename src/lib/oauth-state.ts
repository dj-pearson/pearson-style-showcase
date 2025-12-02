/**
 * OAuth State Parameter Utilities
 * Provides CSRF protection for OAuth flows through state parameter validation
 */

// Storage key for OAuth state
const OAUTH_STATE_KEY = 'oauth_state';
const OAUTH_STATE_EXPIRY_KEY = 'oauth_state_expiry';

// State expiry time (10 minutes)
const STATE_EXPIRY_MS = 10 * 60 * 1000;

/**
 * Generate a cryptographically secure random state parameter
 * @returns A random state string
 */
export function generateOAuthState(): string {
  // Generate 32 bytes of random data and convert to base64url
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);

  // Convert to base64url (URL-safe base64)
  const base64 = btoa(String.fromCharCode(...randomBytes));
  const base64url = base64
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  return base64url;
}

/**
 * Store OAuth state in sessionStorage for later verification
 * @param state - The state parameter to store
 */
export function storeOAuthState(state: string): void {
  try {
    const expiry = Date.now() + STATE_EXPIRY_MS;
    sessionStorage.setItem(OAUTH_STATE_KEY, state);
    sessionStorage.setItem(OAUTH_STATE_EXPIRY_KEY, expiry.toString());
  } catch (error) {
    console.error('Failed to store OAuth state:', error);
  }
}

/**
 * Retrieve and clear stored OAuth state
 * @returns The stored state or null if not found/expired
 */
export function retrieveOAuthState(): string | null {
  try {
    const state = sessionStorage.getItem(OAUTH_STATE_KEY);
    const expiryStr = sessionStorage.getItem(OAUTH_STATE_EXPIRY_KEY);

    // Clear stored state regardless of validity
    sessionStorage.removeItem(OAUTH_STATE_KEY);
    sessionStorage.removeItem(OAUTH_STATE_EXPIRY_KEY);

    if (!state || !expiryStr) {
      return null;
    }

    const expiry = parseInt(expiryStr, 10);
    if (isNaN(expiry) || Date.now() > expiry) {
      console.warn('OAuth state expired');
      return null;
    }

    return state;
  } catch (error) {
    console.error('Failed to retrieve OAuth state:', error);
    return null;
  }
}

/**
 * Verify OAuth state parameter matches stored state
 * @param receivedState - The state parameter from the OAuth callback
 * @returns Object with valid boolean and error message if invalid
 */
export function verifyOAuthState(receivedState: string | null): { valid: boolean; error?: string } {
  if (!receivedState) {
    return { valid: false, error: 'No state parameter in callback' };
  }

  const storedState = retrieveOAuthState();

  if (!storedState) {
    return { valid: false, error: 'No stored state found or state expired' };
  }

  // Timing-safe comparison
  if (receivedState.length !== storedState.length) {
    return { valid: false, error: 'State parameter mismatch' };
  }

  let result = 0;
  for (let i = 0; i < receivedState.length; i++) {
    result |= receivedState.charCodeAt(i) ^ storedState.charCodeAt(i);
  }

  if (result !== 0) {
    return { valid: false, error: 'State parameter mismatch' };
  }

  return { valid: true };
}

/**
 * Generate and store OAuth state, returning the state for use in OAuth request
 * Convenience function combining generation and storage
 * @returns The generated state parameter
 */
export function createOAuthState(): string {
  const state = generateOAuthState();
  storeOAuthState(state);
  return state;
}
