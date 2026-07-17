/**
 * Pure health-aggregation helpers shared by the health-dashboard edge function.
 * Kept dependency-free so the status/HTTP-code logic can be unit-tested.
 */

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface ServiceHealth {
  name: string;
  status: HealthStatus;
  latency?: number;
  message?: string;
  lastChecked: string;
}

export interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
  version: string;
  uptime: number;
  checks: ServiceHealth[];
}

/** Overall status is the worst individual check status. */
export function aggregateHealthStatus(checks: ServiceHealth[]): HealthStatus {
  if (checks.length === 0) return 'unhealthy';
  if (checks.some((c) => c.status === 'unhealthy')) return 'unhealthy';
  if (checks.some((c) => c.status === 'degraded')) return 'degraded';
  return 'healthy';
}

/** HTTP status: 200 for healthy/degraded, 503 for unhealthy. */
export function healthHttpStatus(status: HealthStatus): number {
  return status === 'unhealthy' ? 503 : 200;
}
