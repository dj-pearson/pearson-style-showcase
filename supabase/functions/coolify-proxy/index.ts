/**
 * Coolify Proxy Edge Function
 *
 * Proxies requests to the Coolify API, keeping the API token server-side.
 * Used by the admin dashboard to display real-time container/service health.
 *
 * Environment variables required:
 * - COOLIFY_API_TOKEN: API token from Coolify settings
 * - COOLIFY_BASE_URL: Base URL of the Coolify instance (e.g., https://coolify.example.com)
 *
 * Endpoints (via action param):
 * - resources: List all resources (applications, databases, services)
 * - servers: List all servers
 * - server-resources: List resources for a specific server
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { normalizedErrorResponse, classifyError } from '../_shared/error-normalizer.ts';

const COOLIFY_API_TOKEN = Deno.env.get('COOLIFY_API_TOKEN') ?? '';
const COOLIFY_BASE_URL = Deno.env.get('COOLIFY_BASE_URL') ?? '';
const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB limit
const FETCH_TIMEOUT_MS = 15_000; // 15 second timeout

async function coolifyFetch(path: string): Promise<Response> {
  const url = `${COOLIFY_BASE_URL}/api/v1${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      headers: {
        Authorization: `Bearer ${COOLIFY_API_TOKEN}`,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Safely read response body with size limit to prevent memory exhaustion.
 */
async function safeReadJson(response: Response): Promise<unknown> {
  // Check Content-Length header first (fast path)
  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_RESPONSE_SIZE) {
    throw new Error(
      `Response too large: ${contentLength} bytes exceeds ${MAX_RESPONSE_SIZE} byte limit`
    );
  }

  // Read body with size tracking
  const reader = response.body?.getReader();
  if (!reader) {
    return response.json();
  }

  const chunks: Uint8Array[] = [];
  let totalSize = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalSize += value.byteLength;
    if (totalSize > MAX_RESPONSE_SIZE) {
      reader.cancel();
      throw new Error(`Response too large: exceeded ${MAX_RESPONSE_SIZE} byte limit`);
    }
    chunks.push(value);
  }

  const decoder = new TextDecoder();
  const text = chunks.map((c) => decoder.decode(c, { stream: true })).join('') + decoder.decode();
  return JSON.parse(text);
}

async function verifyAdmin(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return false;

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const token = authHeader.replace('Bearer ', '');
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);
  if (error || !user) return false;

  const { data: whitelist } = await supabase
    .from('admin_whitelist')
    .select('id')
    .eq('email', user.email)
    .maybeSingle();

  return !!whitelist;
}

export default async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Verify admin access
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate Coolify config
    if (!COOLIFY_API_TOKEN || !COOLIFY_BASE_URL) {
      return new Response(JSON.stringify({ error: 'Coolify API not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'resources';

    let coolifyResponse: Response;

    switch (action) {
      case 'servers': {
        coolifyResponse = await coolifyFetch('/servers');
        break;
      }
      case 'server-resources': {
        const serverUuid = url.searchParams.get('serverUuid');
        if (!serverUuid) {
          return new Response(JSON.stringify({ error: 'serverUuid is required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        coolifyResponse = await coolifyFetch(`/servers/${serverUuid}/resources`);
        break;
      }
      case 'applications': {
        coolifyResponse = await coolifyFetch('/applications');
        break;
      }
      case 'databases': {
        coolifyResponse = await coolifyFetch('/databases');
        break;
      }
      case 'services': {
        coolifyResponse = await coolifyFetch('/services');
        break;
      }
      case 'resources':
      default: {
        // Fetch all resource types in parallel
        const [serversRes, appsRes, dbsRes, servicesRes] = await Promise.all([
          coolifyFetch('/servers'),
          coolifyFetch('/applications'),
          coolifyFetch('/databases'),
          coolifyFetch('/services'),
        ]);

        const [servers, applications, databases, services] = await Promise.all([
          serversRes.ok ? safeReadJson(serversRes) : [],
          appsRes.ok ? safeReadJson(appsRes) : [],
          dbsRes.ok ? safeReadJson(dbsRes) : [],
          servicesRes.ok ? safeReadJson(servicesRes) : [],
        ]);

        return new Response(JSON.stringify({ servers, applications, databases, services }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (!coolifyResponse.ok) {
      const errorText = await coolifyResponse.text();
      console.error('Coolify API error:', coolifyResponse.status, errorText);
      const code =
        coolifyResponse.status === 401
          ? ('UNAUTHORIZED' as const)
          : coolifyResponse.status === 403
            ? ('FORBIDDEN' as const)
            : coolifyResponse.status === 404
              ? ('NOT_FOUND' as const)
              : ('SERVICE_UNAVAILABLE' as const);
      return normalizedErrorResponse(code, new Error(errorText), corsHeaders);
    }

    const data = await safeReadJson(coolifyResponse);
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return normalizedErrorResponse(classifyError(error), error, corsHeaders);
  }
};
