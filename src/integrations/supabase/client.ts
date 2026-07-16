// danpearson.net Self-Hosted Supabase Client
// Migrated from cloud Supabase to self-hosted infrastructure
import { createClient } from '@supabase/supabase-js';

// Self-hosted Supabase configuration
// API: api.danpearson.net
// Functions: functions.danpearson.net
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const FUNCTIONS_URL = import.meta.env.VITE_FUNCTIONS_URL || 'https://functions.danpearson.net';

// Validate environment variables - fail fast if not configured
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing required Supabase environment variables. ' +
    'Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.'
  );
}

/**
 * Clear stale auth tokens from localStorage to stop retry loops.
 * Call this when CORS/network errors make the API unreachable.
 */
export function clearStaleAuthTokens(): void {
  try {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('sb-') || key.includes('supabase')) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    // Ignore localStorage errors
  }
}

// Track consecutive failures for fail-fast behavior
let consecutiveProxyFailures = 0;
const MAX_PROXY_FAILURES = 5;
// How long the circuit stays "open" (fail-fast) before allowing a half-open
// probe request that can restore connectivity within the session.
const PROXY_COOLDOWN_MS = 30_000;
let _apiReachable: boolean | null = null;
let _circuitOpenedAt = 0;

export function isApiReachable(): boolean | null {
  return _apiReachable;
}

/**
 * Reset the auth-proxy circuit breaker state. Exported for tests; also safe to
 * call after a manual recovery.
 */
export function resetAuthProxyCircuit(): void {
  consecutiveProxyFailures = 0;
  _apiReachable = null;
  _circuitOpenedAt = 0;
}

/**
 * Custom fetch that routes Supabase Auth requests through the auth-proxy
 * edge function at functions.danpearson.net, bypassing CORS issues with
 * the GoTrue service at api.danpearson.net.
 *
 * Non-auth requests (REST, storage, realtime) go directly to api.danpearson.net.
 */
export const proxyAuthFetch: typeof fetch = async (input, init) => {
  // Circuit breaker: when the proxy has been marked unreachable, fail fast only
  // during the cooldown window. Once the cooldown elapses, fall through and let
  // the next request act as a "half-open" probe that can restore connectivity
  // on success (instead of latching unreachable until a full page reload).
  if (_apiReachable === false && Date.now() - _circuitOpenedAt < PROXY_COOLDOWN_MS) {
    throw new TypeError(
      'Authentication service is temporarily unreachable. Please try again in a moment.'
    );
  }

  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;

  // Check if this is an auth request to api.danpearson.net
  const supabaseHost = new URL(SUPABASE_URL).origin;
  const isAuthRequest = url.startsWith(`${supabaseHost}/auth/`);

  if (isAuthRequest) {
    // Rewrite: https://api.danpearson.net/auth/v1/token?...
    //      ->: https://functions.danpearson.net/auth-proxy/auth/v1/token?...
    const authPath = url.substring(supabaseHost.length); // e.g., /auth/v1/token?grant_type=password
    const proxyUrl = `${FUNCTIONS_URL}/auth-proxy${authPath}`;

    try {
      const response = await fetch(proxyUrl, init);
      // Success - close the circuit and reset failure tracking. A successful
      // half-open probe restores connectivity for the rest of the session.
      consecutiveProxyFailures = 0;
      _apiReachable = true;
      _circuitOpenedAt = 0;
      return response;
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        consecutiveProxyFailures++;
        if (consecutiveProxyFailures >= MAX_PROXY_FAILURES) {
          const wasReachable = _apiReachable !== false;
          _apiReachable = false;
          // (Re)start the cooldown window - a failed probe re-opens the circuit
          // rather than latching it permanently.
          _circuitOpenedAt = Date.now();
          if (wasReachable) {
            // Clear stale tokens only on the initial trip, not on every failed
            // probe, so sustained failure still stops the retry loop but does
            // not permanently block in-session recovery.
            clearStaleAuthTokens();
            console.error(
              '[Supabase] Auth proxy unreachable after multiple attempts. ' +
              'Cleared stale tokens; will retry after a cooldown.'
            );
          }
        }
      }
      throw err;
    }
  }

  // Non-auth requests go directly to api.danpearson.net
  return fetch(input, init);
};

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // Enable OAuth callback detection for social logins (Google, GitHub, etc.)
    // The hash fragment with tokens is automatically parsed and the session is established
    detectSessionInUrl: true,
    // Use PKCE flow for enhanced security with OAuth
    flowType: 'pkce',
  },
  global: {
    fetch: proxyAuthFetch,
  },
});
