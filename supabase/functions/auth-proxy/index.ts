/**
 * Auth Proxy Edge Function
 *
 * Proxies Supabase Auth (GoTrue) requests from the frontend to the
 * internal GoTrue service, adding proper CORS headers.
 *
 * This works around CORS issues when GOTRUE_SITE_URL is set to
 * api.danpearson.net but the frontend is on danpearson.net.
 *
 * Usage from frontend:
 *   Instead of: POST https://api.danpearson.net/auth/v1/token
 *   Route to:   POST https://functions.danpearson.net/auth-proxy/auth/v1/token
 *
 * The function strips the /auth-proxy prefix and forwards to the
 * Supabase API gateway (api.danpearson.net).
 */

import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

// The Supabase URL (Kong gateway)
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://api.danpearson.net';

// Headers to skip when forwarding (hop-by-hop or browser-only headers)
const SKIP_REQUEST_HEADERS = new Set([
  'host',
  'origin',
  'referer',
  'sec-fetch-dest',
  'sec-fetch-mode',
  'sec-fetch-site',
  'sec-ch-ua',
  'sec-ch-ua-mobile',
  'sec-ch-ua-platform',
  'connection',
  'keep-alive',
  'transfer-encoding',
  'upgrade',
  'te',
]);

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);

    // Extract the auth path: /auth-proxy/auth/v1/token -> /auth/v1/token
    const fullPath = url.pathname;
    const authPath = fullPath.replace(/^\/auth-proxy/, '') || '/';

    // Reconstruct the target URL with query parameters
    const targetUrl = `${SUPABASE_URL}${authPath}${url.search}`;

    console.log(`[auth-proxy] ${req.method} ${authPath}${url.search} -> ${targetUrl}`);

    // Forward ALL request headers except hop-by-hop/browser-only ones
    const forwardHeaders = new Headers();
    for (const [key, value] of req.headers.entries()) {
      if (!SKIP_REQUEST_HEADERS.has(key.toLowerCase())) {
        forwardHeaders.set(key, value);
      }
    }

    // Log forwarded headers for debugging
    const headerKeys = [...forwardHeaders.keys()];
    console.log(`[auth-proxy] Forwarding headers: ${headerKeys.join(', ')}`);

    // Read request body if present
    let body: string | null = null;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      try {
        body = await req.text();
      } catch {
        // No body
      }
    }

    // Forward the request to GoTrue (server-to-server, no CORS restrictions)
    const proxyResponse = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body: body,
    });

    // Read the response body
    const responseBody = await proxyResponse.text();

    console.log(`[auth-proxy] Response: ${proxyResponse.status} ${proxyResponse.statusText}`);

    // Log response body on error for debugging
    if (proxyResponse.status >= 400) {
      console.error(`[auth-proxy] Error response body: ${responseBody.substring(0, 500)}`);
    }

    // Build response headers: start with CORS, then forward response headers
    const responseHeaders = new Headers(corsHeaders);

    // Forward all response headers except hop-by-hop
    const skipResponseHeaders = new Set([
      'connection',
      'keep-alive',
      'transfer-encoding',
      'access-control-allow-origin',
      'access-control-allow-methods',
      'access-control-allow-headers',
      'access-control-allow-credentials',
      'access-control-max-age',
    ]);

    for (const [key, value] of proxyResponse.headers.entries()) {
      if (!skipResponseHeaders.has(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    }

    return new Response(responseBody, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error('[auth-proxy] Error:', error);

    return new Response(
      JSON.stringify({
        error: 'Auth proxy error',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 502,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
};
