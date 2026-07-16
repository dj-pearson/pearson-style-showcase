import { assertEquals } from '../test-asserts.ts';
import {
  aggregateHealthStatus,
  healthHttpStatus,
  type ServiceHealth,
} from '../health.ts';

function check(status: ServiceHealth['status']): ServiceHealth {
  return { name: 'x', status, lastChecked: '2026-01-01T00:00:00.000Z' };
}

Deno.test('aggregateHealthStatus is healthy when all checks are healthy', () => {
  assertEquals(aggregateHealthStatus([check('healthy'), check('healthy')]), 'healthy');
});

Deno.test('aggregateHealthStatus is degraded when any check is degraded (and none unhealthy)', () => {
  assertEquals(aggregateHealthStatus([check('healthy'), check('degraded')]), 'degraded');
});

Deno.test('aggregateHealthStatus is unhealthy when any check is unhealthy', () => {
  assertEquals(aggregateHealthStatus([check('degraded'), check('unhealthy')]), 'unhealthy');
});

Deno.test('aggregateHealthStatus treats no checks as unhealthy', () => {
  assertEquals(aggregateHealthStatus([]), 'unhealthy');
});

Deno.test('healthHttpStatus maps healthy/degraded -> 200 and unhealthy -> 503', () => {
  assertEquals(healthHttpStatus('healthy'), 200);
  assertEquals(healthHttpStatus('degraded'), 200);
  assertEquals(healthHttpStatus('unhealthy'), 503);
});
