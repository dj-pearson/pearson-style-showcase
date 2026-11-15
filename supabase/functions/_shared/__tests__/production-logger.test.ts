import { assert, assertEquals } from '../test-asserts.ts';
import { createEdgeFunctionLogger, maskPII, requestIdFrom } from '../production-logger.ts';

function capture(fn: () => void): string[] {
  const lines: string[] = [];
  const orig = { log: console.log, error: console.error, warn: console.warn };
  console.log = (s: string) => lines.push(s);
  console.error = (s: string) => lines.push(s);
  console.warn = (s: string) => lines.push(s);
  try {
    fn();
  } finally {
    Object.assign(console, orig);
  }
  return lines;
}

Deno.test('maskPII masks email addresses', () => {
  assertEquals(maskPII('from jane.doe@example.com'), 'from ja***@example.com');
});

Deno.test('requestIdFrom keeps a safe header and replaces a hostile one', () => {
  const ok = new Request('http://x/', { headers: { 'x-request-id': 'abc-123' } });
  assertEquals(requestIdFrom(ok), 'abc-123');
  const bad = new Request('http://x/', { headers: { 'x-request-id': 'a b;c"' } });
  assert(requestIdFrom(bad) !== 'a b;c"');
});

Deno.test('per-request loggers do not share context', () => {
  const base = createEdgeFunctionLogger('fn');
  const a = base.forRequest(new Request('http://x/', { headers: { 'x-request-id': 'req-a' } }));
  const b = base.forRequest(new Request('http://x/', { headers: { 'x-request-id': 'req-b' } }));
  const lines = capture(() => {
    a.info('one');
    b.info('two');
    a.info('three');
  });
  const ids = lines.map((l) => JSON.parse(l).request_id);
  assertEquals(ids, ['req-a', 'req-b', 'req-a']);
});

Deno.test('error() records plain-object (PostgREST) errors with code', () => {
  const log = createEdgeFunctionLogger('fn');
  const [line] = capture(() =>
    log.error('insert failed', { message: 'duplicate key', code: '23505' }, { to: 'a@b.co' })
  );
  const entry = JSON.parse(line);
  assertEquals(entry.error.code, '23505');
  assertEquals(entry.error.message, 'duplicate key');
  assertEquals(entry.metadata.to, 'a***@b.co');
});
