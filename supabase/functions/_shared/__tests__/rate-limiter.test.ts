import { assertEquals, assert } from '../test-asserts.ts';
import {
  checkRateLimit,
  clearRateLimits,
  getRateLimitStats,
  RATE_LIMIT_PRESETS,
} from '../rate-limiter.ts';

const cfg = (overrides: Record<string, unknown> = {}) => ({
  windowMs: 60_000,
  maxRequests: 3,
  burstAllowance: 0,
  keyPrefix: 'test',
  ...overrides,
});

Deno.test('allows requests under the limit', () => {
  const id = 'under-limit-' + Math.floor(Math.random() * 1e6);
  const config = cfg();
  for (let i = 0; i < 3; i++) {
    assertEquals(checkRateLimit(id, config).allowed, true);
  }
  clearRateLimits(id);
});

Deno.test('blocks requests over the limit', () => {
  const id = 'over-limit-' + Math.floor(Math.random() * 1e6);
  const config = cfg();
  for (let i = 0; i < 3; i++) checkRateLimit(id, config);
  const blocked = checkRateLimit(id, config);
  assertEquals(blocked.allowed, false);
  assert((blocked.retryAfter ?? 0) > 0, 'a blocked result should carry retryAfter');
  clearRateLimits(id);
});

Deno.test('burst allowance permits a few extra requests before blocking', () => {
  const id = 'burst-' + Math.floor(Math.random() * 1e6);
  const config = cfg({ maxRequests: 2, burstAllowance: 1 });
  // 2 normal + 1 burst = 3 allowed, 4th blocked.
  assertEquals(checkRateLimit(id, config).allowed, true);
  assertEquals(checkRateLimit(id, config).allowed, true);
  assertEquals(checkRateLimit(id, config).allowed, true); // burst
  assertEquals(checkRateLimit(id, config).allowed, false);
  clearRateLimits(id);
});

Deno.test('window resets after the window elapses (sliding window)', () => {
  const id = 'window-' + Math.floor(Math.random() * 1e6);
  const config = cfg();
  const realNow = Date.now;
  try {
    let t = 1_000_000;
    globalThis.Date.now = () => t;
    for (let i = 0; i < 3; i++) checkRateLimit(id, config);
    assertEquals(checkRateLimit(id, config).allowed, false); // limit hit
    // Advance beyond the window -> a fresh window is allowed again.
    t += config.windowMs + 1;
    assertEquals(checkRateLimit(id, config).allowed, true);
  } finally {
    globalThis.Date.now = realNow;
    clearRateLimits(id);
  }
});

Deno.test('clearRateLimits removes tracked entries (cleanup)', () => {
  const id = 'cleanup-' + Math.floor(Math.random() * 1e6);
  const config = cfg();
  checkRateLimit(id, config);
  assert(getRateLimitStats().totalKeys > 0);
  const cleared = clearRateLimits(id);
  assert(cleared >= 1, 'should report the number of cleared entries');
});

Deno.test('the auth preset is a strict 5-request / 15-minute limit', () => {
  assertEquals(RATE_LIMIT_PRESETS.auth.maxRequests, 5);
  assertEquals(RATE_LIMIT_PRESETS.auth.windowMs, 15 * 60 * 1000);
});
