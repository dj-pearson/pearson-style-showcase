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
 */

const PORT = parseInt(Deno.env.get('PORT') || '8000');
const FUNCTIONS_DIR = '/app/functions';

const ALLOWED_HEADERS =
  'Content-Type, Authorization, apikey, x-client-info, x-requested-with, x-supabase-api-version, x-csrf-token, x-webhook-signature, x-webhook-timestamp';
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

function b64urlToBytes(part: string): Uint8Array {
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
    status: 'healthy',
    timestamp: new Date().toISOString(),
    domain: 'functions.danpearson.net',
    runtime: 'deno',
    version: Deno.version.deno,
    environment: {
      supabaseUrlConfigured: !!Deno.env.get('SUPABASE_URL'),
      anonKeyConfigured: !!Deno.env.get('SUPABASE_ANON_KEY'),
      serviceRoleKeyConfigured: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
    },
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
 * Main request handler
 */
async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;
  const origin = req.headers.get('Origin');
  const corsHeaders = serverCorsHeaders(origin);

  console.log(`[${new Date().toISOString()}] ${req.method} ${path}`);

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

  // Extract function name from path
  const functionName = path.split('/')[1];

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
    console.log(`Loading function: ${functionName}`);

    // Import the function module
    const functionModule = await import(`file://${functionPath}`);

    // Create a new Request object to pass to the function
    const functionRequest = new Request(req.url, {
      method: req.method,
      headers: req.headers,
      body: req.body,
    });

    // If the module exports a handler, call it directly
    if (typeof functionModule.default === 'function') {
      const response = await functionModule.default(functionRequest);

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
    console.error(`Error executing function '${functionName}':`, error);

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
 * Start the server
 */
console.log(`🚀 Starting danpearson.net Edge Functions Server on port ${PORT}`);
console.log(`📁 Functions directory: ${FUNCTIONS_DIR}`);
console.log(`🌐 CORS origins: ${allowedOrigins().join(', ')}`);
console.log(
  `🔐 JWT verification: ${JWT_SECRET ? 'enabled' : 'NOT CONFIGURED (set SUPABASE_JWT_SECRET)'}`
);
console.log(`🔗 Domain: functions.danpearson.net`);
console.log(`🔗 API Gateway: api.danpearson.net`);

// List available functions on startup
getAvailableFunctions().then((functions) => {
  console.log(`✅ Found ${functions.length} function(s):`);
  functions.forEach((fn) => console.log(`   - ${fn}`));
});

Deno.serve({ port: PORT }, handleRequest);

console.log(`✅ Server running at http://localhost:${PORT}/`);
