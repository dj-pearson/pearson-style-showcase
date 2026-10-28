/**
 * Coolify Server Health Edge Function
 *
 * Proxies requests to the Coolify API to fetch container/resource health.
 * Requires COOLIFY_API_TOKEN and COOLIFY_API_URL env vars set on the server.
 *
 * GET  - Returns all servers, applications, services, and databases
 * POST - Returns data for a specific action (servers, applications, services, databases, resources)
 */

import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import { requireAdmin } from '../_shared/require-admin.ts';

// Coolify resource ids are UUID-like slugs. Anything else is rejected before it
// reaches the URL path so a caller cannot traverse to other API endpoints.
const SERVER_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

async function coolifyFetch(coolifyUrl: string, coolifyToken: string, path: string) {
  const res = await fetch(`${coolifyUrl}/api/v1${path}`, {
    headers: {
      Authorization: `Bearer ${coolifyToken}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    console.error(`Coolify API ${path} returned ${res.status}`);
    return [];
  }
  return res.json();
}

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // Exposes infrastructure inventory through the Coolify API token; admins only.
  const auth = await requireAdmin(req, corsHeaders);
  if (!auth.ok) return auth.response!;

  try {
    const coolifyToken = Deno.env.get('COOLIFY_API_TOKEN');
    const coolifyUrl = Deno.env.get('COOLIFY_API_URL');

    if (!coolifyToken || !coolifyUrl) {
      return new Response(JSON.stringify({ error: 'Coolify API not configured on server' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // GET: Return all resources in a single response
    if (req.method === 'GET') {
      const [servers, applications, services, databases] = await Promise.all([
        coolifyFetch(coolifyUrl, coolifyToken, '/servers'),
        coolifyFetch(coolifyUrl, coolifyToken, '/applications'),
        coolifyFetch(coolifyUrl, coolifyToken, '/services'),
        coolifyFetch(coolifyUrl, coolifyToken, '/databases'),
      ]);

      return new Response(JSON.stringify({ servers, applications, services, databases }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // POST: Return data for a specific action
    const body = await req.json();
    const { action } = body;

    let data: unknown;

    switch (action) {
      case 'servers':
        data = await coolifyFetch(coolifyUrl, coolifyToken, '/servers');
        break;
      case 'applications':
        data = await coolifyFetch(coolifyUrl, coolifyToken, '/applications');
        break;
      case 'services':
        data = await coolifyFetch(coolifyUrl, coolifyToken, '/services');
        break;
      case 'databases':
        data = await coolifyFetch(coolifyUrl, coolifyToken, '/databases');
        break;
      case 'resources':
        data = await coolifyFetch(coolifyUrl, coolifyToken, '/resources');
        break;
      case 'server-resources': {
        const serverId = body.serverId;
        if (typeof serverId !== 'string' || !SERVER_ID_PATTERN.test(serverId)) {
          return new Response(JSON.stringify({ error: 'Valid serverId required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        data = await coolifyFetch(coolifyUrl, coolifyToken, `/servers/${serverId}/resources`);
        break;
      }
      default:
        return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Coolify health error:', error);
    return new Response(JSON.stringify({ error: 'Failed to fetch Coolify health data' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};
