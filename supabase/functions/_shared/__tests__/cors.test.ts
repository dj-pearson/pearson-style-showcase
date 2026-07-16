import { assertEquals, assert } from '../test-asserts.ts';
import { getCorsHeaders, ALLOWED_ORIGINS } from '../cors.ts';
import { createCorsHeaders } from '../validation.ts';

const ACAO = 'Access-Control-Allow-Origin';

Deno.test('getCorsHeaders echoes an allowed origin', () => {
  assertEquals(getCorsHeaders('https://danpearson.net')[ACAO], 'https://danpearson.net');
  assertEquals(getCorsHeaders('http://localhost:8080')[ACAO], 'http://localhost:8080');
});

Deno.test('getCorsHeaders defaults a disallowed origin to production (never wildcard)', () => {
  const h = getCorsHeaders('https://evil.example.com');
  assertEquals(h[ACAO], ALLOWED_ORIGINS[0]);
  assert(h[ACAO] !== '*');
});

Deno.test('getCorsHeaders handles a null origin without a wildcard', () => {
  const h = getCorsHeaders(null);
  assertEquals(h[ACAO], ALLOWED_ORIGINS[0]);
  assert(h[ACAO] !== '*');
});

Deno.test('createCorsHeaders never falls back to a wildcard origin', () => {
  Deno.env.delete('ALLOWED_ORIGIN');
  const h = createCorsHeaders();
  assert(h[ACAO] !== '*');
  assertEquals(h[ACAO], ALLOWED_ORIGINS[0]);
});

Deno.test('createCorsHeaders echoes an allowed origin and rejects others', () => {
  Deno.env.delete('ALLOWED_ORIGIN');
  assertEquals(createCorsHeaders('https://www.danpearson.net')[ACAO], 'https://www.danpearson.net');
  const disallowed = createCorsHeaders('https://evil.example.com');
  assert(disallowed[ACAO] !== 'https://evil.example.com');
  assert(disallowed[ACAO] !== '*');
});
