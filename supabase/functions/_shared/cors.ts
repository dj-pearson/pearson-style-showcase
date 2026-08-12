/**
 * Shared CORS utility for Edge Functions
 * Provides consistent, secure CORS handling across all functions
 */

// Production origins - always allowed.
const DEFAULT_PRODUCTION_ORIGINS = ['https://danpearson.net', 'https://www.danpearson.net'];

// Local development origins - only allowed outside production (never in the
// default production build). See getAllowedOrigins().
const DEV_ORIGINS = ['http://localhost:8080', 'http://localhost:5173', 'http://localhost:3000'];

/**
 * Resolve the allowed CORS origins.
 *
 * Precedence:
 *   1. The ALLOWED_ORIGINS env var (comma-separated) — used verbatim when set,
 *      so operators fully control the list per environment.
 *   2. Otherwise the production origins, plus localhost ONLY when the runtime
 *      explicitly reports a development environment (ENVIRONMENT / DENO_ENV in
 *      {development, dev, local}). Unset defaults to production (no localhost),
 *      so a production deployment never trusts localhost by accident.
 */
export const getAllowedOrigins = (): string[] => {
  const configured = Deno.env.get('ALLOWED_ORIGINS');
  if (configured && configured.trim()) {
    return configured
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }

  const env = (
    Deno.env.get('ENVIRONMENT') ??
    Deno.env.get('DENO_ENV') ??
    'production'
  ).toLowerCase();
  const isDev = env === 'development' || env === 'dev' || env === 'local';
  return isDev ? [...DEFAULT_PRODUCTION_ORIGINS, ...DEV_ORIGINS] : [...DEFAULT_PRODUCTION_ORIGINS];
};

// Snapshot of the allowed origins at module load, for callers/tests that want
// the current list. getCorsHeaders re-resolves per request so runtime env
// changes are always honored.
export const ALLOWED_ORIGINS = getAllowedOrigins();

/**
 * Get CORS headers with proper origin validation
 * @param origin - The origin header from the request
 * @returns CORS headers object
 */
export const getCorsHeaders = (origin: string | null): Record<string, string> => {
  const allowedOrigins = getAllowedOrigins();
  // Check if origin is in allowed list
  const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]; // Default to production domain

  return {
    'Access-Control-Allow-Origin': allowedOrigin,
    // Keep in sync with ALLOWED_HEADERS in danpearson-edge-functions/server.ts.
    // supabase-js v2 sends x-supabase-api-version on preflighted calls, so
    // omitting it here fails the preflight before the handler ever runs.
    'Access-Control-Allow-Headers':
      'authorization, x-client-info, apikey, content-type, cookie, x-csrf-token, x-webhook-signature, x-webhook-timestamp, x-supabase-api-version, x-requested-with',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
    // Responses vary by request Origin; without this a shared cache could serve
    // one origin's allow-list header to another.
    Vary: 'Origin',
  };
};

/**
 * Handle CORS preflight request
 * @param req - The incoming request
 * @returns Response for preflight or null if not a preflight request
 */
export const handleCors = (req: Request): Response | null => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.get('origin');
    return new Response(null, {
      headers: getCorsHeaders(origin),
    });
  }
  return null;
};

/**
 * Create a JSON response with proper CORS headers
 * @param data - Response data
 * @param origin - Request origin
 * @param status - HTTP status code
 * @returns Response with CORS headers
 */
export const corsJsonResponse = (
  data: unknown,
  origin: string | null,
  status: number = 200
): Response => {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...getCorsHeaders(origin),
      'Content-Type': 'application/json',
    },
  });
};
