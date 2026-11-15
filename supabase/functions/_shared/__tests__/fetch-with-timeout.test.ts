import { assert, assertEquals, assertStringIncludes } from '../test-asserts.ts';
import {
  fetchJsonWithTimeout,
  fetchWithTimeout,
  FetchHttpError,
  FetchTimeoutError,
  parseRetryAfter,
} from '../fetch-with-timeout.ts';

type Handler = (req: Request, hit: number) => Response | Promise<Response>;

/** Local stub server; `hits` counts requests it received. */
async function withServer(
  handler: Handler,
  run: (url: string, hits: () => number) => Promise<void>
): Promise<void> {
  let count = 0;
  const server = Deno.serve({ port: 0, hostname: '127.0.0.1', onListen() {} }, (req) =>
    handler(req, ++count)
  );
  const { port } = server.addr as Deno.NetAddr;
  try {
    await run(`http://127.0.0.1:${port}/`, () => count);
  } finally {
    await server.shutdown();
  }
}

async function rejects(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn();
  } catch (err) {
    return err;
  }
  throw new Error('Expected promise to reject');
}

const fast = { retryBaseDelayMs: 10 };
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

Deno.test('parseRetryAfter reads seconds and HTTP dates', () => {
  const now = Date.parse('2026-01-01T00:00:00Z');
  assertEquals(parseRetryAfter('5', now), 5000);
  assertEquals(parseRetryAfter('Thu, 01 Jan 2026 00:00:10 GMT', now), 10_000);
  assertEquals(parseRetryAfter('Wed, 31 Dec 2025 23:59:00 GMT', now), 0);
  assertEquals(parseRetryAfter(null, now), null);
  assertEquals(parseRetryAfter('soon', now), null);
});

Deno.test('GET retries a 503 and returns the later success', async () => {
  await withServer(
    (_req, hit) => (hit === 1 ? new Response('busy', { status: 503 }) : new Response('ok')),
    async (url, hits) => {
      const res = await fetchWithTimeout(url, {}, fast);
      assertEquals(await res.text(), 'ok');
      assertEquals(hits(), 2);
    }
  );
});

Deno.test('GET retries after a timeout', async () => {
  await withServer(
    async (_req, hit) => {
      if (hit === 1) await delay(300);
      return new Response('ok');
    },
    async (url, hits) => {
      const res = await fetchWithTimeout(url, {}, { ...fast, timeoutMs: 100 });
      assertEquals(await res.text(), 'ok');
      assertEquals(hits(), 2);
    }
  );
});

Deno.test('GET returns the last response with its body when retries run out', async () => {
  await withServer(
    () => new Response('still down', { status: 502 }),
    async (url, hits) => {
      const res = await fetchWithTimeout(url, {}, { ...fast, maxRetries: 2 });
      assertEquals(res.status, 502);
      assertEquals(await res.text(), 'still down');
      assertEquals(hits(), 2);
    }
  );
});

Deno.test('POST does not retry a 500', async () => {
  await withServer(
    () => new Response('boom', { status: 500 }),
    async (url, hits) => {
      const res = await fetchWithTimeout(url, { method: 'POST', body: '{}' }, fast);
      assertEquals(res.status, 500);
      await res.body?.cancel();
      assertEquals(hits(), 1);
    }
  );
});

Deno.test('POST does not retry after a timeout', async () => {
  await withServer(
    async () => {
      await delay(300);
      return new Response('late');
    },
    async (url, hits) => {
      const err = await rejects(() =>
        fetchWithTimeout(url, { method: 'POST', body: '{}' }, { ...fast, timeoutMs: 100 })
      );
      assert(err instanceof FetchTimeoutError, `expected FetchTimeoutError, got ${err}`);
      assertEquals(hits(), 1);
    }
  );
});

Deno.test('POST retries 429 only when retryOnRejected is set, honouring Retry-After', async () => {
  const handler: Handler = (_req, hit) =>
    hit === 1
      ? new Response('slow down', { status: 429, headers: { 'Retry-After': '1' } })
      : new Response('ok');

  await withServer(handler, async (url, hits) => {
    const res = await fetchWithTimeout(url, { method: 'POST', body: '{}' }, fast);
    assertEquals(res.status, 429);
    await res.body?.cancel();
    assertEquals(hits(), 1);
  });

  await withServer(handler, async (url, hits) => {
    const started = Date.now();
    const res = await fetchWithTimeout(
      url,
      { method: 'POST', body: '{}' },
      { ...fast, retryOnRejected: true }
    );
    assertEquals(await res.text(), 'ok');
    assertEquals(hits(), 2);
    assert(Date.now() - started >= 900, 'should wait for Retry-After');
  });
});

Deno.test('a Retry-After beyond the cap stops retrying', async () => {
  await withServer(
    () => new Response('later', { status: 503, headers: { 'Retry-After': '3600' } }),
    async (url, hits) => {
      const res = await fetchWithTimeout(url, {}, { ...fast, maxRetryAfterMs: 5_000 });
      assertEquals(res.status, 503);
      assertEquals(await res.text(), 'later');
      assertEquals(hits(), 1);
    }
  );
});

Deno.test('the deadline covers the body, not just the headers', async () => {
  await withServer(
    () => {
      let timer: number | undefined;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('partial'));
          timer = setTimeout(() => {
            try {
              controller.close();
            } catch {
              // client already went away
            }
          }, 400);
        },
        cancel() {
          clearTimeout(timer);
        },
      });
      return new Response(body);
    },
    async (url) => {
      const res = await fetchWithTimeout(url, {}, { ...fast, timeoutMs: 150, maxRetries: 1 });
      assertEquals(res.status, 200);
      const err = await rejects(() => res.text());
      assert(err instanceof FetchTimeoutError, `expected FetchTimeoutError, got ${err}`);
      await delay(300);
    }
  );
});

Deno.test('the discarded response body is cancelled before a retry', async () => {
  let cancelled = false;
  await withServer(
    (_req, hit) => {
      if (hit > 1) return new Response(cancelled ? 'cancelled' : 'not cancelled');
      let timer: number | undefined;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('busy'));
          // Without a cancel from the client this body would stay open for 5s.
          timer = setTimeout(() => controller.close(), 5_000);
        },
        cancel() {
          cancelled = true;
          clearTimeout(timer);
        },
      });
      return new Response(body, { status: 503 });
    },
    async (url, hits) => {
      const res = await fetchWithTimeout(url, {}, { retryBaseDelayMs: 200 });
      assertEquals(await res.text(), 'cancelled');
      assertEquals(hits(), 2);
    }
  );
});

Deno.test('fetchJsonWithTimeout parses JSON on success', async () => {
  await withServer(
    () => Response.json({ hello: 'world' }),
    async (url) => {
      const { status, data } = await fetchJsonWithTimeout<{ hello: string }>(url);
      assertEquals(status, 200);
      assertEquals(data.hello, 'world');
    }
  );
});

Deno.test('fetchJsonWithTimeout throws FetchHttpError with status and truncated body', async () => {
  await withServer(
    () => new Response(`bad request ${'x'.repeat(2000)}`, { status: 400 }),
    async (url) => {
      const err = await rejects(() =>
        fetchJsonWithTimeout(url, { method: 'POST', body: '{}' }, { label: 'stub' })
      );
      assert(err instanceof FetchHttpError, `expected FetchHttpError, got ${err}`);
      const httpErr = err as FetchHttpError;
      assertEquals(httpErr.status, 400);
      assertStringIncludes(httpErr.body, 'bad request');
      assert(httpErr.body.length < 600, 'body should be truncated');
      assertStringIncludes(httpErr.message, '[stub] HTTP 400');
    }
  );
});

Deno.test('fetchJsonWithTimeout reports a non-JSON body', async () => {
  await withServer(
    () => new Response('<html>oops</html>'),
    async (url) => {
      const err = await rejects(() => fetchJsonWithTimeout(url));
      assert(err instanceof FetchHttpError);
      assertStringIncludes((err as FetchHttpError).body, 'invalid JSON');
    }
  );
});
