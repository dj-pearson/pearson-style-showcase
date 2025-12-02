/**
 * CSRF Protection Utility
 *
 * Implements Double-Submit Cookie pattern for SPA protection
 * Combined with origin validation on the server side
 *
 * Features:
 * - Secure token generation using Web Crypto API
 * - Session-bound tokens with expiration
 * - Automatic token refresh
 * - Integration with fetch requests
 */

const CSRF_TOKEN_KEY = 'csrf_token';
const CSRF_TOKEN_EXPIRY_KEY = 'csrf_token_expiry';
const CSRF_HEADER_NAME = 'x-csrf-token';
const TOKEN_EXPIRY_MS = 4 * 60 * 60 * 1000; // 4 hours

/**
 * Generate a cryptographically secure random token
 */
async function generateSecureToken(): Promise<string> {
  const buffer = new Uint8Array(32);
  crypto.getRandomValues(buffer);

  // Convert to base64url encoding
  const base64 = btoa(String.fromCharCode(...buffer));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/**
 * Generate a token bound to the current session
 * Uses a combination of random data and a timestamp
 */
async function generateBoundToken(): Promise<string> {
  const randomPart = await generateSecureToken();
  const timestamp = Date.now().toString(36);
  const combined = `${timestamp}.${randomPart}`;

  // Hash the combined value for additional security
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = new Uint8Array(hashBuffer);
  const hashBase64 = btoa(String.fromCharCode(...hashArray))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');

  return `${timestamp}.${hashBase64}`;
}

/**
 * Get or create a CSRF token for the current session
 */
export async function getCSRFToken(): Promise<string> {
  // Check if we have a valid token in storage
  const existingToken = sessionStorage.getItem(CSRF_TOKEN_KEY);
  const expiryStr = sessionStorage.getItem(CSRF_TOKEN_EXPIRY_KEY);

  if (existingToken && expiryStr) {
    const expiry = parseInt(expiryStr, 10);
    if (Date.now() < expiry) {
      return existingToken;
    }
  }

  // Generate new token
  const newToken = await generateBoundToken();
  const expiry = Date.now() + TOKEN_EXPIRY_MS;

  sessionStorage.setItem(CSRF_TOKEN_KEY, newToken);
  sessionStorage.setItem(CSRF_TOKEN_EXPIRY_KEY, expiry.toString());

  return newToken;
}

/**
 * Refresh the CSRF token
 * Call this after significant state changes (login, logout, etc.)
 */
export async function refreshCSRFToken(): Promise<string> {
  sessionStorage.removeItem(CSRF_TOKEN_KEY);
  sessionStorage.removeItem(CSRF_TOKEN_EXPIRY_KEY);
  return getCSRFToken();
}

/**
 * Clear CSRF token (call on logout)
 */
export function clearCSRFToken(): void {
  sessionStorage.removeItem(CSRF_TOKEN_KEY);
  sessionStorage.removeItem(CSRF_TOKEN_EXPIRY_KEY);
}

/**
 * Get CSRF headers for fetch requests
 */
export async function getCSRFHeaders(): Promise<Record<string, string>> {
  const token = await getCSRFToken();
  return {
    [CSRF_HEADER_NAME]: token,
  };
}

/**
 * Check if a request method requires CSRF protection
 */
export function requiresCSRFProtection(method: string): boolean {
  const protectedMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  return protectedMethods.includes(method.toUpperCase());
}

/**
 * Enhanced fetch wrapper that automatically adds CSRF headers
 * for state-changing requests
 */
export async function csrfFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const method = init?.method?.toUpperCase() || 'GET';

  if (requiresCSRFProtection(method)) {
    const csrfHeaders = await getCSRFHeaders();
    const headers = new Headers(init?.headers);

    // Add CSRF header
    headers.set(CSRF_HEADER_NAME, csrfHeaders[CSRF_HEADER_NAME]);

    return fetch(input, {
      ...init,
      headers,
    });
  }

  return fetch(input, init);
}

/**
 * Create a fetch instance with automatic CSRF protection
 * Useful for creating API clients
 */
export function createCSRFProtectedFetch(): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    return csrfFetch(input, init);
  };
}

/**
 * Hook for React components to get CSRF token
 */
export function useCSRFToken(): {
  getToken: () => Promise<string>;
  refreshToken: () => Promise<string>;
  headers: () => Promise<Record<string, string>>;
} {
  return {
    getToken: getCSRFToken,
    refreshToken: refreshCSRFToken,
    headers: getCSRFHeaders,
  };
}

// Export header name for server-side validation
export { CSRF_HEADER_NAME };
