/**
 * Caller authentication for service-role edge functions.
 *
 * Functions that hold SUPABASE_SERVICE_ROLE_KEY bypass RLS entirely, so the
 * platform's verify_jwt setting is the only thing standing between an
 * anonymous caller and full database access. That setting is honored by the
 * Supabase platform but NOT by the self-hosted danpearson-edge-functions
 * server, so every service-role function has to authenticate its own caller.
 *
 * Two caller shapes are accepted:
 *   - An admin user's JWT (the admin dashboard).
 *   - The service role key itself, for function-to-function invocations such as
 *     receive-email -> send-notification-email. Opt in with allowServiceRole.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { parseBearerToken, safeEqual } from './require-admin-helpers.ts';

export interface RequireAdminOptions {
  /** Accept the service role key as an internal function-to-function caller. */
  allowServiceRole?: boolean;
}

export interface RequireAdminResult {
  /** True when the caller may proceed. */
  ok: boolean;
  /** The response to return verbatim when ok is false. */
  response?: Response;
  /** Authenticated admin user id; absent for internal service-role callers. */
  userId?: string;
  /** True when authenticated as the service role rather than a user. */
  internal?: boolean;
}

function deny(status: number, error: string, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify({ error }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Require that the request comes from an admin user (or, when enabled, from an
 * internal service-role caller). Returns { ok: true } to proceed, otherwise a
 * ready-to-return 401/403 response.
 */
export async function requireAdmin(
  req: Request,
  corsHeaders: Record<string, string>,
  options: RequireAdminOptions = {}
): Promise<RequireAdminResult> {
  const token = parseBearerToken(req.headers.get('Authorization'));
  if (!token) {
    return { ok: false, response: deny(401, 'Unauthorized', corsHeaders) };
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  if (options.allowServiceRole && serviceRoleKey && safeEqual(token, serviceRoleKey)) {
    return { ok: true, internal: true };
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey, {
    auth: { persistSession: false },
  });

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return { ok: false, response: deny(401, 'Unauthorized', corsHeaders) };
  }

  const { data: roleRow } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .maybeSingle();

  if (!roleRow) {
    return { ok: false, response: deny(403, 'Admin access required', corsHeaders) };
  }

  return { ok: true, userId: user.id };
}
