/**
 * danpearson.net Edge Functions Server
 *
 * A custom Deno HTTP server that dynamically loads and serves
 * Supabase Edge Functions from the /functions directory.
 *
 * Domain: functions.danpearson.net
 * API Gateway: api.danpearson.net (Kong)
 *
 * Features:
 * - Dynamic function discovery and loading
 * - Health check endpoint
 * - CORS support
 * - Environment variable management
 * - Error handling and logging
 * - JWT verification support
 * - Per-request deadline (504) and request id (x-request-id)
 * - Startup check of required environment variables, reported on /_health
 */

const PORT = parseInt(Deno.env.get('PORT') || '8000');
// Overridable for local smoke tests; the image always uses /app/functions.
const FUNCTIONS_DIR = Deno.env.get('FUNCTIONS_DIR') || '/app/functions';

const ALLOWED_HEADERS =
  'Content-Type, Authorization, apikey, x-client-info, x-requested-with, x-supabase-api-version, x-csrf-token, x-webhook-signature, x-webhook-timestamp, x-request-id, idempotency-key, x-idempotency-key';
const ALLOWED_METHODS = 'GET, POST, PUT, DELETE, PATCH, OPTIONS';

/**
 * Origins allowed to make credentialed cross-origin requests. Mirrors
 * functions/_shared/cors.ts so the server and the functions agree.
 */
function allowedOrigins(): string[] {
  const configured = Deno.env.get('ALLOWED_ORIGINS');
  if (configured && configured.trim()) {
    return configured
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
  }
  return ['https://danpearson.net', 'https://www.danpearson.net'];
}

function defaultAllowedOrigin(): string {
  return allowedOrigins()[0];
}

/** Resolve the Allow-Origin value for a request, never echoing an unknown one. */
function resolveOrigin(origin: string | null): string {
  const list = allowedOrigins();
  return origin && list.includes(origin) ? origin : list[0];
}

/**
 * CORS headers for the server's own responses (health, root, 404, errors).
 * Allow-Credentials is only sound with a concrete origin; it is never paired
 * with a wildcard here.
 */
function serverCorsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': resolveOrigin(origin),
    'Access-Control-Allow-Methods': ALLOWED_METHODS,
    'Access-Control-Allow-Headers': ALLOWED_HEADERS,
    'Access-Control-Max-Age': '86400', // 24 hours
    'Access-Control-Allow-Credentials': 'true',
    Vary: 'Origin',
  };
}

/**
 * Functions reachable without a bearer token.
 *
 * THIS LIST IS AUTHORITATIVE. supabase/config.toml's verify_jwt flags apply to
 * the Supabase-hosted edge runtime, which this deployment does not use; they
 * are kept there for local `supabase start` only and have drifted from reality
 * before. Anything requiring a token is gated here, so a function added to
 * supabase/functions is authenticated by default until it is listed below.
 *
 * OAuth redirects and provider webhooks arrive without a Supabase session,
 * monitoring probes health-check anonymously, and the public status page reads
 * health-dashboard. Webhook receivers authenticate with their own HMAC check.
 */
const PUBLIC_FUNCTIONS = new Set([
  'admin-auth',
  'oauth-proxy',
  'auth-proxy',
  'health-check',
  // Backs the public status page at /status (src/pages/Status.tsx), which is
  // fetched anonymously and would 401 without this.
  'health-dashboard',
  'track-affiliate-click',
  'newsletter-signup',
  // Opened from links in newsletter email; the one-click unsubscribe POST
  // comes straight from mail providers. Both check their own token.
  'newsletter-confirm',
  'newsletter-unsubscribe',
  'send-contact-email',
  'receive-email',
  'email-webhook-receiver',
]);

const JWT_SECRET = Deno.env.get('SUPABASE_JWT_SECRET') || Deno.env.get('JWT_SECRET') || '';

let cachedKey: CryptoKey | null = null;
async function hmacKey(): Promise<CryptoKey> {
  if (!cachedKey) {
    cachedKey = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(JWT_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
  }
  return cachedKey;
}

// Return type left to inference: an explicit `Uint8Array` widens to
// Uint8Array<ArrayBufferLike> on newer TypeScript, which crypto.subtle rejects.
function b64urlToBytes(part: string) {
  const pad = part.length % 4 === 0 ? '' : '='.repeat(4 - (part.length % 4));
  const b64 = part.replace(/-/g, '+').replace(/_/g, '/') + pad;
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

/**
 * Verify a Supabase HS256 JWT: signature and expiry. Supabase mints the anon
 * and service role keys with this same secret, so internal function-to-function
 * calls verify here too.
 */
async function verifyJwt(token: string): Promise<boolean> {
  const parts = token.split('.');
  if (parts.length !== 3) return false;

  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(),
      b64urlToBytes(parts[2]),
      new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
    );
    if (!valid) return false;

    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(parts[1])));
    if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Environment check
// ---------------------------------------------------------------------------

/**
 * Variables the server cannot work without. Each entry lists alternatives;
 * any one being set satisfies it. Names only: values are never logged or
 * returned.
 */
const REQUIRED_ENV: string[][] = [
  ['SUPABASE_URL'],
  ['SUPABASE_ANON_KEY'],
  ['SUPABASE_SERVICE_ROLE_KEY'],
  // Without it every authenticated function call is refused with 503.
  ['SUPABASE_JWT_SECRET', 'JWT_SECRET'],
];

/**
 * Variables a feature needs. Missing ones break only that feature, so they
 * are warned about, not fatal. Derived from Deno.env.get() calls across
 * supabase/functions; AI keys are named per row in ai_model_configs
 * (api_key_secret_name), and the seeded rows use the names below.
 */
const FEATURE_ENV: Record<string, string[]> = {
  'contact form + newsletter email (Resend)': ['RESEND_API'],
  'ticket and notification email (SMTP)': [
    'AMAZON_SMTP_ENDPOINT',
    'AMAZON_SMTP_USER_NAME',
    'AMAZON_SMTP_PASSWORD',
  ],
  'receive-email webhook': ['MAKE_WEBHOOK_SECRET'],
  newsletter: ['NEWSLETTER_TOKEN_SECRET'],
  'secure vault': ['VAULT_ENCRYPTION_KEY'],
  'oauth-proxy state': ['OAUTH_STATE_SECRET'],
  'AI (seeded Claude config)': ['CLAUDE_API_KEY'],
  'Amazon pipeline product search': ['SERPAPI_KEY'],
};

export interface ConfigReport {
  ok: boolean;
  missingRequired: string[];
  missingByFeature: Record<string, string[]>;
}

export function checkConfig(get: (name: string) => string | undefined): ConfigReport {
  const has = (name: string) => Boolean(get(name)?.trim());
  const missingRequired = REQUIRED_ENV.filter((alts) => !alts.some(has)).map((alts) =>
    alts.join(' or ')
  );
  const missingByFeature: Record<string, string[]> = {};
  for (const [feature, names] of Object.entries(FEATURE_ENV)) {
    const missing = names.filter((n) => !has(n));
    if (missing.length) missingByFeature[feature] = missing;
  }
  return { ok: missingRequired.length === 0, missingRequired, missingByFeature };
}

const CONFIG = checkConfig((name) => Deno.env.get(name));

// ---------------------------------------------------------------------------
// Per-request deadline
// ---------------------------------------------------------------------------

/**
 * Every function runs in this one process, so a request that never finishes
 * holds its connection and memory forever. After the deadline the client gets
 * a 504 and the request's AbortSignal fires; a function that ignores the
 * signal keeps running in the background until it finishes on its own.
 *
 * FUNCTION_TIMEOUT_MS sets the default. FUNCTION_TIMEOUTS overrides single
 * functions: "generate-ai-article=300000,maintenance-runner=600000".
 */
const DEFAULT_TIMEOUT_MS = Number(Deno.env.get('FUNCTION_TIMEOUT_MS')) || 60_000;

const BUILTIN_TIMEOUTS_MS: Record<string, number> = {
  // Multi-step AI pipelines: research, generation, quality pass, publish.
  'generate-ai-article': 300_000,
  'amazon-article-pipeline': 300_000,
  // run_due waits for the content pipelines above.
  'maintenance-runner': 600_000,
  // Single AI or vision calls with retries.
  'ai-content-generator': 150_000,
  'create-invoice-from-document': 150_000,
  'extract-from-url': 150_000,
  'generate-ai-tasks': 150_000,
  'generate-social-content': 150_000,
  'generate-ticket-response': 150_000,
  'process-accounting-document': 150_000,
  'test-ai-model': 150_000,
  'test-api-setup': 150_000,
  'optimize-image': 150_000,
};

export function parseTimeoutOverrides(raw: string | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const pair of (raw || '').split(',')) {
    const [name, ms] = pair.split('=').map((x) => x.trim());
    const n = Number(ms);
    if (name && Number.isFinite(n) && n > 0) out[name] = n;
  }
  return out;
}

const TIMEOUTS_MS = {
  ...BUILTIN_TIMEOUTS_MS,
  ...parseTimeoutOverrides(Deno.env.get('FUNCTION_TIMEOUTS')),
};

function timeoutFor(functionName: string): number {
  return TIMEOUTS_MS[functionName] ?? DEFAULT_TIMEOUT_MS;
}

class DeadlineExceeded extends Error {}

/** Settle with `work`, or reject with DeadlineExceeded after `ms`. */
export async function withDeadline<T>(work: Promise<T>, ms: number, onTimeout: () => void) {
  let timer: number | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout();
      reject(new DeadlineExceeded(`deadline of ${ms}ms exceeded`));
    }, ms);
  });
  try {
    return await Promise.race([work, deadline]);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Request id
// ---------------------------------------------------------------------------

/** Reuse a caller's x-request-id if it is short and header-safe. */
export function requestIdFor(req: Request): string {
  const supplied = req.headers.get('x-request-id') || '';
  return /^[A-Za-z0-9._:-]{1,100}$/.test(supplied) ? supplied : crypto.randomUUID();
}

/**
 * Get list of available functions by scanning the functions directory
 */
async function getAvailableFunctions(): Promise<string[]> {
  const functions: string[] = [];

  try {
    for await (const entry of Deno.readDir(FUNCTIONS_DIR)) {
      if (entry.isDirectory && !entry.name.startsWith('_')) {
        // Check if index.ts exists in the function directory
        try {
          const indexPath = `${FUNCTIONS_DIR}/${entry.name}/index.ts`;
          await Deno.stat(indexPath);
          functions.push(entry.name);
        } catch {
          // index.ts doesn't exist, skip this directory
        }
      }
    }
  } catch (error) {
    console.error('Error reading functions directory:', error);
  }

  return functions.sort();
}

/**
 * Health check endpoint handler
 */
async function handleHealthCheck(origin: string | null): Promise<Response> {
  const functions = await getAvailableFunctions();

  const healthData = {
    // Still HTTP 200 when degraded: the container healthcheck restarts on a
    // failure, and a restart can't fix a missing variable.
    status: CONFIG.ok ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    domain: 'functions.danpearson.net',
    runtime: 'deno',
    version: Deno.version.deno,
    environment: {
      supabaseUrlConfigured: !!Deno.env.get('SUPABASE_URL'),
      anonKeyConfigured: !!Deno.env.get('SUPABASE_ANON_KEY'),
      serviceRoleKeyConfigured: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    },
    // Variable names only, never values. Checked once at startup.
    config: CONFIG,
    functions: functions.length,
    functionList: functions,
  };

  return new Response(JSON.stringify(healthData, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...serverCorsHeaders(origin),
    },
  });
}

/**
 * Handle OPTIONS requests for CORS preflight
 */
function handleOptions(req: Request): Response {
  return new Response(null, {
    status: 204,
    headers: serverCorsHeaders(req.headers.get('Origin')),
  });
}

/**
 * Main request handler: assigns the request id, routes, and writes one JSON
 * access line per request: {id, fn, method, status, ms}.
 */
async function handleRequest(req: Request): Promise<Response> {
  const start = Date.now();
  const requestId = requestIdFor(req);
  const path = new URL(req.url).pathname;
  const fn = path.split('/')[1] || '';

  const response = await routeRequest(req, requestId, fn);

  const headers = new Headers(response.headers);
  headers.set('x-request-id', requestId);
  if (!headers.has('Access-Control-Expose-Headers')) {
    headers.set('Access-Control-Expose-Headers', 'x-request-id');
  }

  // Probes and preflights would drown the log.
  if (req.method !== 'OPTIONS' && fn !== '_health' && fn !== 'health') {
    const line = JSON.stringify({
      ts: new Date().toISOString(),
      id: requestId,
      fn: fn || '/',
      method: req.method,
      status: response.status,
      ms: Date.now() - start,
    });
    if (response.status >= 500) console.error(line);
    else console.log(line);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function routeRequest(req: Request, requestId: string, functionName: string) {
  const url = new URL(req.url);
  const path = url.pathname;
  const origin = req.headers.get('Origin');
  const corsHeaders = serverCorsHeaders(origin);

  // Handle OPTIONS for CORS preflight
  if (req.method === 'OPTIONS') {
    return handleOptions(req);
  }

  // Health check endpoint
  if (path === '/_health' || path === '/health') {
    return await handleHealthCheck(origin);
  }

  // Root endpoint - return welcome message
  if (path === '/') {
    const functions = await getAvailableFunctions();
    return new Response(
      JSON.stringify(
        {
          message: 'danpearson.net Edge Functions Server',
          domain: 'functions.danpearson.net',
          apiGateway: 'api.danpearson.net',
          version: '1.0.0',
          functions,
          usage: 'POST /{function-name} with JSON body',
        },
        null,
        2
      ),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }

  if (!functionName) {
    return new Response(JSON.stringify({ error: 'Function name required' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }

  // Gateway-level authentication. supabase/config.toml's verify_jwt is honored
  // by the Supabase platform, not by this server, so enforce it here: without
  // this every function was reachable unauthenticated. Functions holding the
  // service role key still check their own caller (see _shared/require-admin).
  if (!PUBLIC_FUNCTIONS.has(functionName)) {
    const token = req.headers
      .get('Authorization')
      ?.replace(/^Bearer\s+/i, '')
      .trim();
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    if (!JWT_SECRET) {
      // Fail closed: an unset secret must not silently downgrade to no checks.
      console.error('SUPABASE_JWT_SECRET is not configured; refusing authenticated function calls');
      return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
    if (!(await verifyJwt(token))) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }
  }

  // Build function path
  const functionPath = `${FUNCTIONS_DIR}/${functionName}/index.ts`;

  // Check if function exists
  try {
    await Deno.stat(functionPath);
  } catch {
    return new Response(
      JSON.stringify({
        error: `Function '${functionName}' not found`,
        availableFunctions: await getAvailableFunctions(),
      }),
      {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }

  // Dynamically import and execute the function
  try {
    // Import the function module (cached by Deno after the first load)
    const functionModule = await import(`file://${functionPath}`);

    // Forward the request with the request id, so the function's own log
    // lines (production-logger reads x-request-id) join up with ours, and
    // with a signal that fires at the deadline.
    const forwardedHeaders = new Headers(req.headers);
    forwardedHeaders.set('x-request-id', requestId);
    const abort = new AbortController();
    const functionRequest = new Request(req.url, {
      method: req.method,
      headers: forwardedHeaders,
      body: req.body,
      signal: abort.signal,
    });

    // If the module exports a handler, call it directly
    if (typeof functionModule.default === 'function') {
      const timeoutMs = timeoutFor(functionName);
      const pending: Promise<Response> = Promise.resolve(functionModule.default(functionRequest));
      let response: Response;
      try {
        response = await withDeadline(pending, timeoutMs, () => abort.abort());
      } catch (error) {
        if (!(error instanceof DeadlineExceeded)) throw error;
        // Release the late response's body whenever it does arrive.
        pending.then((late) => late.body?.cancel()).catch(() => {});
        console.error(
          JSON.stringify({ id: requestId, fn: functionName, event: 'deadline', ms: timeoutMs })
        );
        return new Response(
          JSON.stringify({ error: 'Function timed out', request_id: requestId }),
          {
            status: 504,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      // Do NOT overwrite the function's own CORS headers. Functions build them
      // with _shared/cors.ts, which answers only allow-listed origins. Echoing
      // the request Origin back alongside Allow-Credentials: true, as this used
      // to, let any site make credentialed cross-origin calls.
      const headers = new Headers(response.headers);
      if (!headers.has('Access-Control-Allow-Origin')) {
        // Function returned no CORS headers of its own; fall back to the
        // configured allow-list rather than reflecting the caller's Origin.
        headers.set('Access-Control-Allow-Origin', defaultAllowedOrigin());
      }
      headers.set('Vary', 'Origin');

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    // If no handler is exported, return an error
    return new Response(
      JSON.stringify({
        error: `Function '${functionName}' does not export a handler`,
        hint: 'Functions must export a default handler: export default async (req: Request): Promise<Response> => {...}. serve() and Deno.serve() are not dispatched by this server.',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    // Log the detail server-side; the response must not carry the message or
    // stack, which expose file paths, env names and internal control flow.
    console.error(`[${requestId}] Error executing function '${functionName}':`, error);

    return new Response(
      JSON.stringify({
        error: 'Function execution failed',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      }
    );
  }
}

/**
 * Start the server. Guarded so a test can import the helpers above without
 * binding a port.
 */
if (import.meta.main) {
  console.log(`🚀 Starting danpearson.net Edge Functions Server on port ${PORT}`);
  console.log(`📁 Functions directory: ${FUNCTIONS_DIR}`);
  console.log(`🌐 CORS origins: ${allowedOrigins().join(', ')}`);
  console.log(
    `🔐 JWT verification: ${JWT_SECRET ? 'enabled' : 'NOT CONFIGURED (set SUPABASE_JWT_SECRET)'}`
  );
  console.log(
    `Function deadline: ${DEFAULT_TIMEOUT_MS}ms default, overrides for ${Object.keys(TIMEOUTS_MS).length} functions`
  );
  if (CONFIG.missingRequired.length) {
    console.error(
      `MISSING REQUIRED ENV: ${CONFIG.missingRequired.join(', ')}. /_health reports "degraded" until they are set.`
    );
  }
  for (const [feature, names] of Object.entries(CONFIG.missingByFeature)) {
    console.warn(`Env warning: ${feature} will not work (${names.join(', ')} not set)`);
  }
  console.log(`🔗 Domain: functions.danpearson.net`);
  console.log(`🔗 API Gateway: api.danpearson.net`);

  // List available functions on startup
  getAvailableFunctions().then((functions) => {
    console.log(`✅ Found ${functions.length} function(s):`);
    functions.forEach((fn) => console.log(`   - ${fn}`));
  });

  Deno.serve({ port: PORT }, handleRequest);

  console.log(`✅ Server running at http://localhost:${PORT}/`);
}
