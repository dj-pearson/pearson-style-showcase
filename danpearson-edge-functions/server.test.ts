// deno test --no-check --allow-env --allow-read danpearson-edge-functions/server.test.ts
import { assert, assertEquals } from '../supabase/functions/_shared/test-asserts.ts';
import { checkConfig, parseTimeoutOverrides, requestIdFor, withDeadline } from './server.ts';

Deno.test('checkConfig reports missing required names, accepting either JWT secret', () => {
  const env: Record<string, string> = {
    SUPABASE_URL: 'x',
    SUPABASE_ANON_KEY: 'x',
    SUPABASE_SERVICE_ROLE_KEY: 'x',
    JWT_SECRET: 'x',
  };
  const ok = checkConfig((n) => env[n]);
  assertEquals(ok.ok, true);
  assertEquals(ok.missingRequired, []);
  assert(ok.missingByFeature['contact form + newsletter email (Resend)'].includes('RESEND_API'));

  delete env.JWT_SECRET;
  env.SUPABASE_URL = '  ';
  const bad = checkConfig((n) => env[n]);
  assertEquals(bad.ok, false);
  assertEquals(bad.missingRequired, ['SUPABASE_URL', 'SUPABASE_JWT_SECRET or JWT_SECRET']);
});

Deno.test('parseTimeoutOverrides ignores junk', () => {
  assertEquals(parseTimeoutOverrides('a=100, b = 2000,c=x,=5,d=-1'), { a: 100, b: 2000 });
  assertEquals(parseTimeoutOverrides(undefined), {});
});

Deno.test('withDeadline passes a fast result through and times out a slow one', async () => {
  assertEquals(await withDeadline(Promise.resolve(7), 50, () => {}), 7);

  let aborted = false;
  let timer: number | undefined;
  const slow = new Promise((r) => (timer = setTimeout(r, 500)));
  try {
    await withDeadline(slow, 20, () => (aborted = true));
    throw new Error('should have timed out');
  } catch (error) {
    assert(String(error).includes('deadline of 20ms exceeded'));
  } finally {
    clearTimeout(timer);
  }
  assertEquals(aborted, true);
});

Deno.test('requestIdFor reuses a safe id and replaces an unsafe one', () => {
  const ok = new Request('http://x/', { headers: { 'x-request-id': 'abc.123' } });
  assertEquals(requestIdFor(ok), 'abc.123');
  const bad = new Request('http://x/', { headers: { 'x-request-id': 'has space' } });
  assert(requestIdFor(bad) !== 'has space');
});
