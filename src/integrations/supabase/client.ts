// danpearson.net Self-Hosted Supabase Client
// Migrated from cloud Supabase to self-hosted infrastructure
import { createClient } from '@supabase/supabase-js';

// Self-hosted Supabase configuration
// API: api.danpearson.net
// Functions: functions.danpearson.net
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables - fail fast if not configured
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing required Supabase environment variables. ' +
    'Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.'
  );
}

// Track consecutive CORS/network failures to prevent infinite retry loops
let consecutiveNetworkFailures = 0;
const MAX_NETWORK_FAILURES = 3;
let _apiReachable: boolean | null = null;

/**
 * Check if the Supabase API is currently reachable.
 * Returns cached result after initial determination.
 */
export function isApiReachable(): boolean | null {
  return _apiReachable;
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
    consecutiveNetworkFailures = 0;
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Custom fetch wrapper that detects CORS/network errors and prevents
 * infinite retry loops from Supabase's autoRefreshToken.
 */
const resilientFetch: typeof fetch = async (input, init) => {
  // If we've already determined the API is unreachable, fail fast
  if (_apiReachable === false) {
    throw new TypeError(
      'Supabase API is unreachable (CORS or network error). ' +
      'Check that api.danpearson.net has CORS configured for your origin.'
    );
  }

  try {
    const response = await fetch(input, init);
    // Successful response - reset failure count
    consecutiveNetworkFailures = 0;
    _apiReachable = true;
    return response;
  } catch (err) {
    // TypeError: Failed to fetch = CORS or network error
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      consecutiveNetworkFailures++;

      if (consecutiveNetworkFailures >= MAX_NETWORK_FAILURES) {
        _apiReachable = false;
        // Clear stale tokens to stop the autoRefreshToken retry loop
        clearStaleAuthTokens();
        console.error(
          `[Supabase] API unreachable after ${MAX_NETWORK_FAILURES} attempts. ` +
          'This is likely a CORS configuration issue on api.danpearson.net. ' +
          'Cleared stale tokens to prevent retry loop.'
        );
      }
    }
    throw err;
  }
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
    fetch: resilientFetch,
  },
});