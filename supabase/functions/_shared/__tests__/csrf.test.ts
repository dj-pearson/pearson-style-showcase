import { assert, assertEquals } from '../test-asserts.ts';
import { validateCsrf, isStateChanging } from '../csrf.ts';

function req(method: string, headers: Record<string, string>): Request {
  return new Request('https://functions.danpearson.net/admin-auth', { method, headers });
}

const GOOD_TOKEN = 'a'.repeat(24);

function clearEnv() {
  Deno.env.delete('ALLOWED_ORIGINS');
  Deno.env.delete('ENVIRONMENT');
  Deno.env.delete('DENO_ENV');
}

Deno.test('isStateChanging flags mutating methods', () => {
  for (const m of ['POST', 'put', 'Patch', 'DELETE']) assert(isStateChanging(m));
  for (const m of ['GET', 'HEAD', 'OPTIONS']) assert(!isStateChanging(m));
});

Deno.test('valid request: allowed origin + token passes', () => {
  clearEnv();
  const r = validateCsrf(
    req('POST', { origin: 'https://danpearson.net', 'x-csrf-token': GOOD_TOKEN })
  );
  assert(r.valid);
});

Deno.test('no Origin header (server-to-server) still requires a token', () => {
  clearEnv();
  assert(validateCsrf(req('POST', { 'x-csrf-token': GOOD_TOKEN })).valid);
  const missing = validateCsrf(req('POST', {}));
  assert(!missing.valid);
  assertEquals(missing.reason, 'missing_csrf_token');
});

Deno.test('disallowed origin is rejected (forgery signal)', () => {
  clearEnv();
  const r = validateCsrf(
    req('POST', { origin: 'https://evil.example.com', 'x-csrf-token': GOOD_TOKEN })
  );
  assert(!r.valid);
  assertEquals(r.reason, 'origin_not_allowed');
});

Deno.test('missing or too-short token is rejected', () => {
  clearEnv();
  assertEquals(
    validateCsrf(req('POST', { origin: 'https://danpearson.net' })).reason,
    'missing_csrf_token'
  );
  assertEquals(
    validateCsrf(req('POST', { origin: 'https://danpearson.net', 'x-csrf-token': 'short' })).reason,
    'missing_csrf_token'
  );
});
