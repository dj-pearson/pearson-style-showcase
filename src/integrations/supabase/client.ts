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
let _apiReachable: boolean | null = null;

export function isApiReachable(): boolean | null {
  return _apiReachable;
}

/**
 * Custom fetch that routes Supabase Auth requests through the auth-proxy
 * edge function at functions.danpearson.net, bypassing CORS issues with
 * the GoTrue service at api.danpearson.net.
 *
 * Non-auth requests (REST, storage, realtime) go directly to api.danpearson.net.
 */
const proxyAuthFetch: typeof fetch = async (input, init) => {
  // Fail fast if proxy is unreachable
  if (_apiReachable === false) {
    throw new TypeError(
      'Authentication service is unreachable. Please try again later.'
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
      // Success - reset failure tracking
      consecutiveProxyFailures = 0;
      _apiReachable = true;
      return response;
    } catch (err) {
      if (err instanceof TypeError && err.message === 'Failed to fetch') {
        consecutiveProxyFailures++;
        if (consecutiveProxyFailures >= MAX_PROXY_FAILURES) {
          _apiReachable = false;
          clearStaleAuthTokens();
          console.error(
            '[Supabase] Auth proxy unreachable after multiple attempts. ' +
            'Cleared stale tokens to prevent retry loop.'
          );
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
