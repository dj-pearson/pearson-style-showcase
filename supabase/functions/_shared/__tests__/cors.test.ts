import { assertEquals, assert } from '../test-asserts.ts';
import { getCorsHeaders, getAllowedOrigins, ALLOWED_ORIGINS } from '../cors.ts';
import { createCorsHeaders } from '../validation.ts';

const ACAO = 'Access-Control-Allow-Origin';

function clearEnv() {
  Deno.env.delete('ALLOWED_ORIGINS');
  Deno.env.delete('ENVIRONMENT');
  Deno.env.delete('DENO_ENV');
}

Deno.test('getCorsHeaders echoes an allowed production origin', () => {
  clearEnv();
  assertEquals(getCorsHeaders('https://danpearson.net')[ACAO], 'https://danpearson.net');
  assertEquals(getCorsHeaders('https://www.danpearson.net')[ACAO], 'https://www.danpearson.net');
});

Deno.test('localhost is NOT allowed by default (production)', () => {
  clearEnv();
  const origins = getAllowedOrigins();
  assert(!origins.some((o) => o.includes('localhost')));
  // A localhost origin falls back to the production default, not echoed.
  assertEquals(getCorsHeaders('http://localhost:8080')[ACAO], origins[0]);
});

Deno.test('localhost IS allowed when the runtime is development', () => {
  clearEnv();
  Deno.env.set('DENO_ENV', 'development');
  try {
    assertEquals(getCorsHeaders('http://localhost:8080')[ACAO], 'http://localhost:8080');
  } finally {
    clearEnv();
  }
});

Deno.test('ALLOWED_ORIGINS env var controls the list verbatim', () => {
  clearEnv();
  Deno.env.set('ALLOWED_ORIGINS', 'https://staging.example.com, https://app.example.com');
  try {
    assertEquals(
      getCorsHeaders('https://staging.example.com')[ACAO],
      'https://staging.example.com'
    );
    assertEquals(getCorsHeaders('https://app.example.com')[ACAO], 'https://app.example.com');
    // localhost and the built-in production domain are excluded when overridden.
    assertEquals(getCorsHeaders('http://localhost:8080')[ACAO], 'https://staging.example.com');
    assertEquals(getCorsHeaders('https://danpearson.net')[ACAO], 'https://staging.example.com');
  } finally {
    clearEnv();
  }
});

Deno.test('getCorsHeaders defaults a disallowed origin to production (never wildcard)', () => {
  clearEnv();
  const h = getCorsHeaders('https://evil.example.com');
  assertEquals(h[ACAO], getAllowedOrigins()[0]);
  assert(h[ACAO] !== '*');
});

Deno.test('getCorsHeaders handles a null origin without a wildcard', () => {
  clearEnv();
  const h = getCorsHeaders(null);
  assertEquals(h[ACAO], getAllowedOrigins()[0]);
  assert(h[ACAO] !== '*');
});

Deno.test('ALLOWED_ORIGINS snapshot excludes localhost by default', () => {
  assert(!ALLOWED_ORIGINS.some((o) => o.includes('localhost')));
});

Deno.test('createCorsHeaders never falls back to a wildcard origin', () => {
  Deno.env.delete('ALLOWED_ORIGIN');
  const h = createCorsHeaders();
  assert(h[ACAO] !== '*');
});

Deno.test('createCorsHeaders echoes an allowed origin and rejects others', () => {
  Deno.env.delete('ALLOWED_ORIGIN');
  assertEquals(createCorsHeaders('https://www.danpearson.net')[ACAO], 'https://www.danpearson.net');
  const disallowed = createCorsHeaders('https://evil.example.com');
  assert(disallowed[ACAO] !== 'https://evil.example.com');
  assert(disallowed[ACAO] !== '*');
});
