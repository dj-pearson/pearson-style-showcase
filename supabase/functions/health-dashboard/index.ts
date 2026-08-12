/**
 * Health Dashboard Edge Function (US-015)
 *
 * Returns structured JSON describing overall system health:
 *   { status, timestamp, version, uptime, checks: [...] }
 * where each check reports database connectivity and edge-function runtime.
 *
 * HTTP 200 for healthy/degraded, HTTP 503 for unhealthy. Public (no auth) so a
 * status page and external monitors can poll it. Each check is bounded to keep
 * the whole response under ~5 seconds.
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.51.0';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';
import {
  aggregateHealthStatus,
  healthHttpStatus,
  type HealthResponse,
  type ServiceHealth,
} from '../_shared/health.ts';

const VERSION = Deno.env.get('APP_VERSION') || '1.0.0';
const CHECK_TIMEOUT_MS = 4000;

// Module load time approximates process start for an uptime estimate.
const START_TIME = Date.now();

/** Run a promise with a timeout, resolving to a degraded/unhealthy check on timeout. */
// PromiseLike, not Promise: Postgrest query builders are thenables and are
// passed in directly by the database check below.
function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T | 'timeout'> {
  return Promise.race([
    promise,
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ms)),
  ]);
}

async function checkDatabase(): Promise<ServiceHealth> {
  const lastChecked = new Date().toISOString();
  const start = Date.now();
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const result = await withTimeout(
      supabase.from('articles').select('id', { count: 'exact', head: true }),
      CHECK_TIMEOUT_MS
    );

    const latency = Date.now() - start;

    if (result === 'timeout') {
      return { name: 'database', status: 'unhealthy', latency, message: 'timeout', lastChecked };
    }
    if ((result as { error?: unknown }).error) {
      return {
        name: 'database',
        status: 'unhealthy',
        latency,
        message: String(
          (result as { error?: { message?: string } }).error?.message ?? 'query error'
        ),
        lastChecked,
      };
    }
    // Slow but working -> degraded.
    const status: ServiceHealth['status'] = latency > 1000 ? 'degraded' : 'healthy';
    return { name: 'database', status, latency, lastChecked };
  } catch (err) {
    return {
      name: 'database',
      status: 'unhealthy',
      latency: Date.now() - start,
      message: err instanceof Error ? err.message : String(err),
      lastChecked,
    };
  }
}

export default async (req: Request): Promise<Response> => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  // The runtime is healthy if we are executing this handler at all.
  const runtimeCheck: ServiceHealth = {
    name: 'edge-runtime',
    status: 'healthy',
    lastChecked: new Date().toISOString(),
  };

  const dbCheck = await checkDatabase();
  const checks: ServiceHealth[] = [dbCheck, runtimeCheck];

  const status = aggregateHealthStatus(checks);
  const body: HealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    version: VERSION,
    uptime: Math.round((Date.now() - START_TIME) / 1000),
    checks,
  };

  return new Response(JSON.stringify(body), {
    status: healthHttpStatus(status),
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
};
