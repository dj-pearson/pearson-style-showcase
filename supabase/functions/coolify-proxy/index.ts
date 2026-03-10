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

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

const COOLIFY_API_TOKEN = Deno.env.get("COOLIFY_API_TOKEN") ?? "";
const COOLIFY_BASE_URL = Deno.env.get("COOLIFY_BASE_URL") ?? "";

async function coolifyFetch(path: string): Promise<Response> {
  const url = `${COOLIFY_BASE_URL}/api/v1${path}`;
  return fetch(url, {
    headers: {
      "Authorization": `Bearer ${COOLIFY_API_TOKEN}`,
      "Accept": "application/json",
    },
  });
}

async function verifyAdmin(req: Request): Promise<boolean> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return false;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return false;

  const { data: whitelist } = await supabase
    .from("admin_whitelist")
    .select("id")
    .eq("email", user.email)
    .maybeSingle();

  return !!whitelist;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  try {
    // Verify admin access
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate Coolify config
    if (!COOLIFY_API_TOKEN || !COOLIFY_BASE_URL) {
      return new Response(
        JSON.stringify({ error: "Coolify API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action") || "resources";

    let coolifyResponse: Response;

    switch (action) {
      case "servers": {
        coolifyResponse = await coolifyFetch("/servers");
        break;
      }
      case "server-resources": {
        const serverUuid = url.searchParams.get("serverUuid");
        if (!serverUuid) {
          return new Response(
            JSON.stringify({ error: "serverUuid is required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        coolifyResponse = await coolifyFetch(`/servers/${serverUuid}/resources`);
        break;
      }
      case "applications": {
        coolifyResponse = await coolifyFetch("/applications");
        break;
      }
      case "databases": {
        coolifyResponse = await coolifyFetch("/databases");
        break;
      }
      case "services": {
        coolifyResponse = await coolifyFetch("/services");
        break;
      }
      case "resources":
      default: {
        // Fetch all resource types in parallel
        const [serversRes, appsRes, dbsRes, servicesRes] = await Promise.all([
          coolifyFetch("/servers"),
          coolifyFetch("/applications"),
          coolifyFetch("/databases"),
          coolifyFetch("/services"),
        ]);

        const [servers, applications, databases, services] = await Promise.all([
          serversRes.ok ? serversRes.json() : [],
          appsRes.ok ? appsRes.json() : [],
          dbsRes.ok ? dbsRes.json() : [],
          servicesRes.ok ? servicesRes.json() : [],
        ]);

        return new Response(
          JSON.stringify({ servers, applications, databases, services }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!coolifyResponse.ok) {
      const errorText = await coolifyResponse.text();
      return new Response(
        JSON.stringify({ error: `Coolify API error: ${coolifyResponse.status}`, details: errorText }),
        { status: coolifyResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await coolifyResponse.json();
    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
