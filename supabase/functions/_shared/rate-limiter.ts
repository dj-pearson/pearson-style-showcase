/**
 * Shared Rate Limiting Module for Edge Functions
 *
 * Provides configurable rate limiting with:
 * - Multiple rate limit tiers (by endpoint, user, IP)
 * - Sliding window algorithm
 * - Burst allowance
 * - Automatic cleanup of expired entries
 * - Headers for rate limit info (X-RateLimit-*)
 */

// Rate limit configuration presets
export interface RateLimitConfig {
  windowMs: number;        // Time window in milliseconds
  maxRequests: number;     // Max requests per window
  burstAllowance?: number; // Extra requests allowed in burst
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  keyPrefix?: string;      // Prefix for rate limit keys
}

// Default rate limit presets
export const RATE_LIMIT_PRESETS = {
  // Strict limits for auth endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    burstAllowance: 0,
    keyPrefix: 'auth',
  },

  // Standard API limits
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    burstAllowance: 10,
    keyPrefix: 'api',
  },

  // Generous limits for read-only endpoints
  read: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 120,
    burstAllowance: 20,
    keyPrefix: 'read',
  },

  // Strict limits for write operations
  write: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 30,
    burstAllowance: 5,
    keyPrefix: 'write',
  },

  // Very strict limits for expensive operations (AI, etc.)
  expensive: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 5,
    burstAllowance: 2,
    keyPrefix: 'expensive',
  },

  // Health check endpoints (very generous)
  health: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 1000,
    burstAllowance: 100,
    keyPrefix: 'health',
  },
} as const;

// Rate limit entry tracking requests
interface RateLimitEntry {
  count: number;
  windowStart: number;
  burstUsed: number;
}

// In-memory store for rate limits (per function instance)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup interval
let cleanupInterval: ReturnType<typeof setInterval> | null = null;
const CLEANUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

/**
 * Initialize the rate limiter with periodic cleanup
 */
export function initRateLimiter(): void {
  if (cleanupInterval) return;

  cleanupInterval = setInterval(() => {
    cleanupExpiredEntries();
  }, CLEANUP_INTERVAL);

  console.log('[RateLimiter] Initialized with cleanup interval');
}

/**
 * Clean up expired rate limit entries
 */
function cleanupExpiredEntries(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [key, entry] of rateLimitStore.entries()) {
    // Find the max window from presets
    const maxWindow = Math.max(
      ...Object.values(RATE_LIMIT_PRESETS).map(p => p.windowMs)
    );

    if (now - entry.windowStart > maxWindow * 2) {
      rateLimitStore.delete(key);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    console.log(`[RateLimiter] Cleaned up ${cleaned} expired entries`);
  }
}

/**
 * Generate a rate limit key
 */
function generateKey(
  identifier: string,
  prefix?: string,
  endpoint?: string
): string {
  const parts = [prefix || 'default', identifier];
  if (endpoint) {
    parts.push(endpoint.replace(/[^a-zA-Z0-9]/g, '_'));
  }
  return parts.join(':');
}

/**
 * Get client identifier from request (IP address)
 */
export function getClientIdentifier(req: Request): string {
  // Try various headers for the real IP
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // Get the first IP in the chain
    return forwardedFor.split(',')[0].trim();
  }

  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }

  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  return 'unknown';
}

/**
 * Rate limit result
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
  headers: Record<string, string>;
}

/**
 * Check rate limit for a request
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig,
  endpoint?: string
): RateLimitResult {
  const now = Date.now();
  const key = generateKey(identifier, config.keyPrefix, endpoint);

  let entry = rateLimitStore.get(key);

  // Create new entry if none exists or window expired
  if (!entry || now - entry.windowStart >= config.windowMs) {
    entry = {
      count: 0,
      windowStart: now,
      burstUsed: 0,
    };
    rateLimitStore.set(key, entry);
  }

  const windowRemaining = config.windowMs - (now - entry.windowStart);
  const resetAt = entry.windowStart + config.windowMs;

  // Calculate effective limit including burst
  const burstAllowance = config.burstAllowance || 0;
  const effectiveLimit = config.maxRequests + burstAllowance;
  const burstRemaining = burstAllowance - entry.burstUsed;

  // Check if allowed
  const allowed = entry.count < config.maxRequests ||
    (entry.burstUsed < burstAllowance);

  if (allowed) {
    entry.count++;

    // Use burst if over normal limit
    if (entry.count > config.maxRequests) {
      entry.burstUsed++;
    }
  }

  const remaining = Math.max(0, effectiveLimit - entry.count);
  const retryAfter = allowed ? undefined : Math.ceil(windowRemaining / 1000);

  // Build headers
  const headers: Record<string, string> = {
    'X-RateLimit-Limit': String(config.maxRequests),
    'X-RateLimit-Remaining': String(remaining),
    'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
  };

  if (burstAllowance > 0) {
    headers['X-RateLimit-Burst-Remaining'] = String(burstRemaining);
  }

  if (retryAfter) {
    headers['Retry-After'] = String(retryAfter);
  }

  return {
    allowed,
    remaining,
    resetAt,
    retryAfter,
    headers,
  };
}

/**
 * Create a rate-limited response
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string>
): Response {
  return new Response(
    JSON.stringify({
      error: 'Too many requests',
      message: 'Rate limit exceeded. Please try again later.',
      retryAfter: result.retryAfter,
      resetAt: new Date(result.resetAt).toISOString(),
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        ...result.headers,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Rate limiting middleware wrapper for edge functions
 */
export function withRateLimit(
  handler: (req: Request) => Promise<Response>,
  config: RateLimitConfig | keyof typeof RATE_LIMIT_PRESETS = 'api',
  options?: {
    getIdentifier?: (req: Request) => string;
    getEndpoint?: (req: Request) => string;
    getCorsHeaders?: (origin: string | null) => Record<string, string>;
    skipMethods?: string[];
  }
): (req: Request) => Promise<Response> {
  // Initialize rate limiter
  initRateLimiter();

  // Get config from preset if string provided
  const resolvedConfig: RateLimitConfig = typeof config === 'string'
    ? RATE_LIMIT_PRESETS[config]
    : config;

  return async (req: Request): Promise<Response> => {
    const origin = req.headers.get('origin');

    // Skip rate limiting for certain methods (e.g., OPTIONS for CORS)
    const skipMethods = options?.skipMethods || ['OPTIONS'];
    if (skipMethods.includes(req.method)) {
      return handler(req);
    }

    // Get identifier
    const identifier = options?.getIdentifier
      ? options.getIdentifier(req)
      : getClientIdentifier(req);

    // Get endpoint
    const endpoint = options?.getEndpoint
      ? options.getEndpoint(req)
      : new URL(req.url).pathname;

    // Check rate limit
    const result = checkRateLimit(identifier, resolvedConfig, endpoint);

    // If rate limited, return 429
    if (!result.allowed) {
      const corsHeaders = options?.getCorsHeaders
        ? options.getCorsHeaders(origin)
        : { 'Access-Control-Allow-Origin': origin || '*' };

      console.log(`[RateLimiter] Rate limit exceeded for ${identifier} on ${endpoint}`);
      return createRateLimitResponse(result, corsHeaders);
    }

    // Call the handler
    const response = await handler(req);

    // Add rate limit headers to response
    const newHeaders = new Headers(response.headers);
    for (const [key, value] of Object.entries(result.headers)) {
      newHeaders.set(key, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  };
}

/**
 * Get rate limit stats
 */
export function getRateLimitStats(): {
  totalKeys: number;
  keysByPrefix: Record<string, number>;
} {
  const keysByPrefix: Record<string, number> = {};

  for (const key of rateLimitStore.keys()) {
    const prefix = key.split(':')[0];
    keysByPrefix[prefix] = (keysByPrefix[prefix] || 0) + 1;
  }

  return {
    totalKeys: rateLimitStore.size,
    keysByPrefix,
  };
}

/**
 * Clear rate limits for a specific identifier
 */
export function clearRateLimits(identifier: string): number {
  let cleared = 0;

  for (const key of rateLimitStore.keys()) {
    if (key.includes(identifier)) {
      rateLimitStore.delete(key);
      cleared++;
    }
  }

  return cleared;
}

/**
 * Rate limit by user ID (for authenticated endpoints)
 */
export function rateLimitByUser(
  req: Request,
  userId: string,
  config: RateLimitConfig | keyof typeof RATE_LIMIT_PRESETS = 'api'
): RateLimitResult {
  const resolvedConfig = typeof config === 'string'
    ? RATE_LIMIT_PRESETS[config]
    : config;

  const endpoint = new URL(req.url).pathname;
  return checkRateLimit(`user:${userId}`, resolvedConfig, endpoint);
}

/**
 * Combined rate limiting (by IP AND user)
 */
export function combinedRateLimit(
  req: Request,
  userId: string | null,
  ipConfig: RateLimitConfig | keyof typeof RATE_LIMIT_PRESETS = 'api',
  userConfig: RateLimitConfig | keyof typeof RATE_LIMIT_PRESETS = 'api'
): RateLimitResult {
  // Check IP rate limit
  const ip = getClientIdentifier(req);
  const ipResult = checkRateLimit(
    ip,
    typeof ipConfig === 'string' ? RATE_LIMIT_PRESETS[ipConfig] : ipConfig
  );

  if (!ipResult.allowed) {
    return ipResult;
  }

  // Check user rate limit if authenticated
  if (userId) {
    const userResult = checkRateLimit(
      `user:${userId}`,
      typeof userConfig === 'string' ? RATE_LIMIT_PRESETS[userConfig] : userConfig
    );

    if (!userResult.allowed) {
      return userResult;
    }

    // Return the more restrictive result
    return ipResult.remaining < userResult.remaining ? ipResult : userResult;
  }

  return ipResult;
}
