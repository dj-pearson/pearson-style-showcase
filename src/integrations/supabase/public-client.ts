// Lean data client for the public site.
//
// The full client in ./client.ts is built with createClient(), which pulls in
// auth-js, realtime-js, storage-js and functions-js: about 55 kB gzip that
// anonymous visitors never use. Public pages only read published rows and call
// edge functions, so this module talks to PostgREST directly with the anon key
// and loads the full client only when a stored login exists.
//
// Use `publicDb` for anonymous reads and inserts. Use `getAccessToken()` or
// `getDbForCurrentUser()` when the request should carry the signed-in admin's
// JWT, as it did when every module imported the full client. Admin and auth
// code keeps importing `supabase` from ./client.ts.
import { PostgrestClient } from '@supabase/postgrest-js';
import { getStoredCSRFTokenSync, requiresCSRFProtection, CSRF_HEADER_NAME } from '@/lib/csrf';

// `?? {}` because scripts/prerender.mjs bundles static-articles.ts (which
// imports this module) and evaluates it in Node, where import.meta.env does
// not exist. For the same reason a missing variable is reported on the first
// request rather than at import time, unlike ./client.ts.
const env: Partial<ImportMetaEnv> = import.meta.env ?? {};
const SUPABASE_URL: string = env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY: string = env.VITE_SUPABASE_ANON_KEY ?? '';

/**
 * The localStorage key auth-js persists the session under. createClient()
 * derives it from the first label of the API host (api.danpearson.net gives
 * "sb-api-auth-token") and ./client.ts does not override it.
 */
const authStorageKey = (): string =>
  `sb-${new URL(SUPABASE_URL).hostname.split('.')[0]}-auth-token`;

/**
 * Attaches the CSRF token to state-changing requests, matching what
 * proxyAuthFetch in ./client.ts does for the full client.
 */
const csrfFetch: typeof fetch = (input, init) => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return Promise.reject(
      new Error(
        'Missing required Supabase environment variables. ' +
          'Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.'
      )
    );
  }
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  if (requiresCSRFProtection(method)) {
    const csrfToken = getStoredCSRFTokenSync();
    if (csrfToken) {
      const headers = new Headers(init?.headers);
      if (!headers.has(CSRF_HEADER_NAME)) headers.set(CSRF_HEADER_NAME, csrfToken);
      init = { ...init, headers };
    }
  }
  return fetch(input, init);
};

/**
 * PostgREST client authenticated as the anon role, with the same headers
 * supabase-js sends when nobody is signed in. Row Level Security applies
 * exactly as it does for an anonymous call through the full client. Untyped,
 * like the createClient() call in ./client.ts, so call sites can switch
 * between the two without new type errors.
 */
export const publicDb = new PostgrestClient(`${SUPABASE_URL}/rest/v1`, {
  headers: {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  },
  fetch: csrfFetch,
});

/** True when auth-js has a persisted session in this browser. */
export function hasStoredSession(): boolean {
  try {
    return localStorage.getItem(authStorageKey()) !== null;
  } catch {
    return false;
  }
}

/**
 * The signed-in user's access token, or null for anonymous visitors. Only
 * loads the full client (which refreshes an expired token) when a session is
 * stored, so anonymous page views never download auth-js.
 */
export async function getAccessToken(): Promise<string | null> {
  if (!hasStoredSession()) return null;
  const { supabase } = await import('@/integrations/supabase/client');
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

/**
 * A data client that acts as whoever is signed in: the full client when a
 * session is stored (so the request carries the user's JWT), otherwise the
 * anon `publicDb`.
 */
export async function getDbForCurrentUser(): Promise<Pick<typeof publicDb, 'from' | 'rpc'>> {
  if (!hasStoredSession()) return publicDb;
  const { supabase } = await import('@/integrations/supabase/client');
  return supabase;
}
