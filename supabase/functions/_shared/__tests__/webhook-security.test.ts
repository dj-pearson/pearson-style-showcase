import { assert, assertEquals } from '../test-asserts.ts';
import {
  generateSignature,
  verifyWebhookRequest,
  verifyWebhookSignature,
} from '../webhook-security.ts';

const SECRET = 'test-webhook-secret-not-real';
const BODY = JSON.stringify({ event: 'ticket.created', id: 42 });

const nowSeconds = () => Math.floor(Date.now() / 1000);

/** Signs the way a sender must: HMAC over `${timestamp}.${body}`. */
async function sign(body: string, timestamp: number | string) {
  return await generateSignature(`${timestamp}.${body}`, SECRET);
}

Deno.test('generateSignature is hex HMAC-SHA256 and deterministic', async () => {
  const a = await generateSignature(BODY, SECRET);
  assert(/^[0-9a-f]{64}$/.test(a));
  assertEquals(a, await generateSignature(BODY, SECRET));
  assert(a !== (await generateSignature(BODY, 'other-secret')));
});

Deno.test('accepts a valid signature without a prefix', async () => {
  const ts = String(nowSeconds());
  const sig = await sign(BODY, ts);
  assertEquals(await verifyWebhookSignature(BODY, sig, SECRET, ts), { valid: true });
});

Deno.test('accepts a valid signature with the sha256= prefix, in either case', async () => {
  const ts = String(nowSeconds());
  const sig = await sign(BODY, ts);
  assertEquals(await verifyWebhookSignature(BODY, `sha256=${sig}`, SECRET, ts), { valid: true });
  assertEquals(await verifyWebhookSignature(BODY, sig.toUpperCase(), SECRET, ts), {
    valid: true,
  });
});

Deno.test('rejects a tampered body', async () => {
  const ts = String(nowSeconds());
  const sig = await sign(BODY, ts);
  const tampered = BODY.replace('42', '43');
  assertEquals(await verifyWebhookSignature(tampered, sig, SECRET, ts), {
    valid: false,
    error: 'Invalid webhook signature',
  });
});

Deno.test('rejects a signature made with a different secret', async () => {
  const ts = String(nowSeconds());
  const sig = await generateSignature(`${ts}.${BODY}`, 'wrong-secret');
  const result = await verifyWebhookSignature(BODY, sig, SECRET, ts);
  assertEquals(result.valid, false);
});

Deno.test('rejects a signature over the body alone when a timestamp is sent', async () => {
  // The timestamp is part of the signed string, so an old body-only signature
  // cannot be paired with a fresh timestamp.
  const ts = String(nowSeconds());
  const bodyOnly = await generateSignature(BODY, SECRET);
  assertEquals((await verifyWebhookSignature(BODY, bodyOnly, SECRET, ts)).valid, false);
});

Deno.test('rejects a timestamp more than 300 seconds old', async () => {
  const ts = String(nowSeconds() - 301);
  const sig = await sign(BODY, ts);
  assertEquals(await verifyWebhookSignature(BODY, sig, SECRET, ts), {
    valid: false,
    error: 'Webhook timestamp too old',
  });
});

Deno.test('accepts a timestamp just inside the 300 second window', async () => {
  const ts = String(nowSeconds() - 290);
  const sig = await sign(BODY, ts);
  assertEquals((await verifyWebhookSignature(BODY, sig, SECRET, ts)).valid, true);
});

Deno.test('honours a custom maxAgeSeconds', async () => {
  const ts = String(nowSeconds() - 20);
  const sig = await sign(BODY, ts);
  assertEquals(
    (await verifyWebhookSignature(BODY, sig, SECRET, ts, 10)).error,
    'Webhook timestamp too old'
  );
});

Deno.test('rejects a timestamp more than 60 seconds in the future', async () => {
  const ts = String(nowSeconds() + 61);
  const sig = await sign(BODY, ts);
  assertEquals(await verifyWebhookSignature(BODY, sig, SECRET, ts), {
    valid: false,
    error: 'Webhook timestamp in the future',
  });
});

Deno.test('tolerates up to 60 seconds of clock skew into the future', async () => {
  const ts = String(nowSeconds() + 30);
  const sig = await sign(BODY, ts);
  assertEquals((await verifyWebhookSignature(BODY, sig, SECRET, ts)).valid, true);
});

Deno.test('rejects a missing timestamp by default', async () => {
  const sig = await generateSignature(BODY, SECRET);
  for (const missing of [undefined, null, '']) {
    assertEquals(await verifyWebhookSignature(BODY, sig, SECRET, missing), {
      valid: false,
      error: 'Missing webhook timestamp',
    });
  }
});

Deno.test('a missing timestamp is allowed only with requireTimestamp: false', async () => {
  const sig = await generateSignature(BODY, SECRET);
  assertEquals(
    await verifyWebhookSignature(BODY, sig, SECRET, null, 300, { requireTimestamp: false }),
    { valid: true }
  );
});

Deno.test('rejects a non-numeric timestamp', async () => {
  for (const bad of ['abc', '12.5', '-100', '1e9', ' 1700000000', '0x10']) {
    const sig = await sign(BODY, bad);
    assertEquals(
      await verifyWebhookSignature(BODY, sig, SECRET, bad),
      { valid: false, error: 'Invalid timestamp format' },
      `timestamp ${JSON.stringify(bad)}`
    );
  }
});

Deno.test('rejects a missing signature before anything else', async () => {
  const ts = String(nowSeconds());
  assertEquals(await verifyWebhookSignature(BODY, null, SECRET, ts), {
    valid: false,
    error: 'Missing webhook signature',
  });
  assertEquals(
    (await verifyWebhookSignature(BODY, '', SECRET, ts)).error,
    'Missing webhook signature'
  );
});

Deno.test('verifyWebhookRequest reads the signature and timestamp headers', async () => {
  const ts = String(nowSeconds());
  const sig = await sign(BODY, ts);
  const ok = await verifyWebhookRequest(
    new Request('https://example.test/hook', {
      method: 'POST',
      body: BODY,
      headers: { 'x-hub-signature-256': `sha256=${sig}`, 'x-timestamp': ts },
    }),
    SECRET
  );
  assertEquals(ok, { valid: true, payload: BODY });

  const bad = await verifyWebhookRequest(
    new Request('https://example.test/hook', {
      method: 'POST',
      body: BODY,
      headers: { 'x-webhook-signature': sig },
    }),
    SECRET
  );
  assertEquals(bad.valid, false);
  if (!bad.valid) assertEquals(bad.response.status, 401);
});
