/**
 * Health Check Edge Function
 *
 * Provides /health and /ready endpoints for monitoring and orchestration.
 *
 * Endpoints:
 * - /health: Basic liveness check (is the function running?)
 * - /ready: Readiness check (can the function handle requests?)
 * - /deep: Deep health check (database, external services)
 *
 * Response format follows Kubernetes health check conventions.
 */

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.51.0";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";
import { getRateLimitStats } from "../_shared/rate-limiter.ts";

// Health status types
type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

interface ServiceHealth {
  name: string;
  status: HealthStatus;
  latency?: number;
  message?: string;
  lastChecked: string;
}

interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  version: string;
  uptime: number;
  checks?: ServiceHealth[];
  metrics?: {
    memory?: {
      used: number;
      total: number;
      percentage: number;
    };
    rateLimits?: {
      totalKeys: number;
      keysByPrefix: Record<string, number>;
    };
  };
}

// Track function start time for uptime calculation
const startTime = Date.now();

// Version from environment or default
const VERSION = Deno.env.get('FUNCTION_VERSION') || '1.0.0';

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<ServiceHealth> {
  const startCheck = Date.now();
  const checkTime = new Date().toISOString();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Simple query to verify database connectivity
    const { error } = await supabase
      .from('admin_whitelist')
      .select('id')
      .limit(1);

    const latency = Date.now() - startCheck;

    if (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        latency,
        message: error.message,
        lastChecked: checkTime,
      };
    }

    // Consider degraded if latency is high (> 1 second)
    const status = latency > 1000 ? 'degraded' : 'healthy';

    return {
      name: 'database',
      status,
      latency,
      message: status === 'degraded' ? 'High latency detected' : undefined,
      lastChecked: checkTime,
    };
  } catch (err) {
    return {
      name: 'database',
      status: 'unhealthy',
      latency: Date.now() - startCheck,
      message: err instanceof Error ? err.message : 'Unknown error',
      lastChecked: checkTime,
    };
  }
}

/**
 * Check external API availability (example: Resend)
 */
async function checkExternalAPIs(): Promise<ServiceHealth[]> {
  const services: ServiceHealth[] = [];
  const checkTime = new Date().toISOString();

  // Check Resend API (email service)
  const resendApiKey = Deno.env.get('RESEND_API');
  if (resendApiKey) {
    const startCheck = Date.now();
    try {
      // Simple API key validation endpoint
      const response = await fetch('https://api.resend.com/domains', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
        },
      });

      const latency = Date.now() - startCheck;
      const status = response.ok ? 'healthy' : 'degraded';

      services.push({
        name: 'email_service',
        status,
        latency,
        message: !response.ok ? `API returned ${response.status}` : undefined,
        lastChecked: checkTime,
      });
    } catch (err) {
      services.push({
        name: 'email_service',
        status: 'unhealthy',
        latency: Date.now() - startCheck,
        message: err instanceof Error ? err.message : 'Unknown error',
        lastChecked: checkTime,
      });
    }
  }

  // Check OpenAI API if configured
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
  if (openaiApiKey) {
    const startCheck = Date.now();
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
        },
      });

      const latency = Date.now() - startCheck;
      const status = response.ok ? 'healthy' : 'degraded';

      services.push({
        name: 'ai_service',
        status,
        latency,
        message: !response.ok ? `API returned ${response.status}` : undefined,
        lastChecked: checkTime,
      });
    } catch (err) {
      services.push({
        name: 'ai_service',
        status: 'unhealthy',
        latency: Date.now() - startCheck,
        message: err instanceof Error ? err.message : 'Unknown error',
        lastChecked: checkTime,
      });
    }
  }

  return services;
}

/**
 * Calculate overall health status from individual checks
 */
function calculateOverallStatus(checks: ServiceHealth[]): HealthStatus {
  const hasUnhealthy = checks.some(c => c.status === 'unhealthy');
  const hasDegraded = checks.some(c => c.status === 'degraded');

  if (hasUnhealthy) return 'unhealthy';
  if (hasDegraded) return 'degraded';
  return 'healthy';
}

/**
 * Get memory usage metrics
 */
function getMemoryMetrics(): { used: number; total: number; percentage: number } | undefined {
  try {
    // Deno memory info (may not be available in all environments)
    const memInfo = Deno.memoryUsage();
    return {
      used: memInfo.heapUsed,
      total: memInfo.heapTotal,
      percentage: Math.round((memInfo.heapUsed / memInfo.heapTotal) * 100),
    };
  } catch {
    return undefined;
  }
}

serve(async (req: Request): Promise<Response> => {
  const origin = req.headers.get("origin");
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const url = new URL(req.url);
  const path = url.pathname.split('/').pop() || '';
  const checkType = url.searchParams.get('type') || path || 'health';

  try {
    const timestamp = new Date().toISOString();
    const uptime = Math.floor((Date.now() - startTime) / 1000);

    // Basic liveness check
    if (checkType === 'health' || checkType === 'liveness') {
      const response: HealthResponse = {
        status: 'healthy',
        timestamp,
        version: VERSION,
        uptime,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // Readiness check (basic + database)
    if (checkType === 'ready' || checkType === 'readiness') {
      const dbHealth = await checkDatabase();

      const response: HealthResponse = {
        status: dbHealth.status,
        timestamp,
        version: VERSION,
        uptime,
        checks: [dbHealth],
      };

      const httpStatus = dbHealth.status === 'unhealthy' ? 503 : 200;

      return new Response(JSON.stringify(response), {
        status: httpStatus,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // Deep health check (all services + metrics)
    if (checkType === 'deep' || checkType === 'full') {
      const checks: ServiceHealth[] = [];

      // Check database
      checks.push(await checkDatabase());

      // Check external APIs
      const externalChecks = await checkExternalAPIs();
      checks.push(...externalChecks);

      // Get metrics
      const memory = getMemoryMetrics();
      const rateLimits = getRateLimitStats();

      const overallStatus = calculateOverallStatus(checks);

      const response: HealthResponse = {
        status: overallStatus,
        timestamp,
        version: VERSION,
        uptime,
        checks,
        metrics: {
          memory,
          rateLimits,
        },
      };

      const httpStatus = overallStatus === 'unhealthy' ? 503 :
                         overallStatus === 'degraded' ? 200 : 200;

      return new Response(JSON.stringify(response), {
        status: httpStatus,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // Metrics endpoint (Prometheus-compatible format)
    if (checkType === 'metrics') {
      const memory = getMemoryMetrics();
      const rateLimits = getRateLimitStats();

      const metrics = [
        `# HELP health_uptime_seconds Function uptime in seconds`,
        `# TYPE health_uptime_seconds gauge`,
        `health_uptime_seconds ${uptime}`,
        '',
      ];

      if (memory) {
        metrics.push(
          `# HELP health_memory_used_bytes Memory used by the function`,
          `# TYPE health_memory_used_bytes gauge`,
          `health_memory_used_bytes ${memory.used}`,
          '',
          `# HELP health_memory_total_bytes Total memory available to the function`,
          `# TYPE health_memory_total_bytes gauge`,
          `health_memory_total_bytes ${memory.total}`,
          ''
        );
      }

      metrics.push(
        `# HELP health_rate_limit_keys Total number of rate limit keys`,
        `# TYPE health_rate_limit_keys gauge`,
        `health_rate_limit_keys ${rateLimits.totalKeys}`,
        ''
      );

      return new Response(metrics.join('\n'), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/plain; charset=utf-8',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      });
    }

    // Unknown check type
    return new Response(
      JSON.stringify({
        error: 'Unknown health check type',
        availableTypes: ['health', 'ready', 'deep', 'metrics'],
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Health check error:', error);

    return new Response(
      JSON.stringify({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        version: VERSION,
        uptime: Math.floor((Date.now() - startTime) / 1000),
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 503,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
