/**
 * Shared CORS utility for Edge Functions
 * Provides consistent, secure CORS handling across all functions
 */

// Allowed origins - add production and development domains here
export const ALLOWED_ORIGINS = [
  // Production
  "https://danpearson.net",
  "https://www.danpearson.net",

  // Lovable project domains
  "https://53293242-1a3e-40cf-bf21-2a4867985711.lovableproject.com",
  "https://9bf99955-d7e1-4b0d-8abc-f62199d56772.lovableproject.com",
  "https://id-preview--53293242-1a3e-40cf-bf21-2a4867985711.lovable.app",
  "https://id-preview--9bf99955-d7e1-4b0d-8abc-f62199d56772.lovable.app",
  "https://pearson-style-showcase.lovable.app",
  "https://preview--pearson-style-showcase.lovable.app",

  // Local development
  "http://localhost:8080",
  "http://localhost:5173",
  "http://localhost:3000",
];

/**
 * Get CORS headers with proper origin validation
 * @param origin - The origin header from the request
 * @returns CORS headers object
 */
export const getCorsHeaders = (origin: string | null): Record<string, string> => {
  // Check if origin is in allowed list
  const allowedOrigin = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : ALLOWED_ORIGINS[0]; // Default to production domain

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-signature, x-webhook-timestamp",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400", // Cache preflight for 24 hours
  };
};

/**
 * Handle CORS preflight request
 * @param req - The incoming request
 * @returns Response for preflight or null if not a preflight request
 */
export const handleCors = (req: Request): Response | null => {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("origin");
    return new Response(null, {
      headers: getCorsHeaders(origin)
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
      "Content-Type": "application/json",
    },
  });
};
