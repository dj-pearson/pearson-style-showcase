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

import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

// The internal Supabase URL (Kong gateway)
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "https://api.danpearson.net";

// Headers that should be forwarded from the client request
const FORWARD_REQUEST_HEADERS = [
  "authorization",
  "apikey",
  "content-type",
  "x-client-info",
  "x-requested-with",
  "accept",
  "accept-language",
];

// Headers from GoTrue response to forward back to client
const FORWARD_RESPONSE_HEADERS = [
  "content-type",
  "x-auth-token",
  "x-request-id",
  "retry-after",
];

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);

    // Extract the auth path: /auth-proxy/auth/v1/token -> /auth/v1/token
    const fullPath = url.pathname;
    const authPath = fullPath.replace(/^\/auth-proxy/, "") || "/";

    // Reconstruct the target URL with query parameters
    const targetUrl = `${SUPABASE_URL}${authPath}${url.search}`;

    console.log(`[auth-proxy] ${req.method} ${authPath}${url.search} -> ${targetUrl}`);

    // Build headers to forward
    const forwardHeaders = new Headers();
    for (const headerName of FORWARD_REQUEST_HEADERS) {
      const value = req.headers.get(headerName);
      if (value) {
        forwardHeaders.set(headerName, value);
      }
    }

    // Read request body if present
    let body: string | null = null;
    if (req.method !== "GET" && req.method !== "HEAD") {
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

    console.log(`[auth-proxy] Response: ${proxyResponse.status}`);

    // Read the response body
    const responseBody = await proxyResponse.text();

    // Build response headers with CORS
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
    };

    // Forward relevant response headers
    for (const headerName of FORWARD_RESPONSE_HEADERS) {
      const value = proxyResponse.headers.get(headerName);
      if (value) {
        responseHeaders[headerName] = value;
      }
    }

    // Ensure content-type is set
    if (!responseHeaders["content-type"]) {
      responseHeaders["content-type"] = "application/json";
    }

    return new Response(responseBody, {
      status: proxyResponse.status,
      statusText: proxyResponse.statusText,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[auth-proxy] Error:", error);

    return new Response(
      JSON.stringify({
        error: "Auth proxy error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 502,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
};
