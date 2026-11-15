import { assert, assertEquals } from '../test-asserts.ts';
import {
  CONFIRMATION_TTL_MS,
  generateConfirmationToken,
  hashToken,
  isConfirmationExpired,
  isWellFormedConfirmationToken,
  signUnsubscribeToken,
  verifyUnsubscribeToken,
} from '../newsletter-tokens.ts';

const ID = '5b0f3c2e-9a41-4d7e-8c11-2f6a7b8c9d0e';
const SECRET = 'test-secret-not-real';

Deno.test('confirmation tokens are 256-bit base64url and stored only as a hash', async () => {
  const { token, hash } = await generateConfirmationToken();
  assert(isWellFormedConfirmationToken(token));
  assertEquals(hash, await hashToken(token));
  assert(/^[0-9a-f]{64}$/.test(hash));
  assert(!hash.includes(token));
});

Deno.test('two confirmation tokens never repeat', async () => {
  const a = await generateConfirmationToken();
  const b = await generateConfirmationToken();
  assert(a.token !== b.token);
});

Deno.test('rejects malformed confirmation tokens', () => {
  assertEquals(isWellFormedConfirmationToken(''), false);
  assertEquals(isWellFormedConfirmationToken('a'.repeat(42)), false);
  assertEquals(isWellFormedConfirmationToken('a'.repeat(42) + '='), false);
  assertEquals(isWellFormedConfirmationToken(42), false);
});

Deno.test('confirmation expires after seven days', () => {
  const sent = Date.parse('2026-11-01T00:00:00Z');
  const iso = new Date(sent).toISOString();
  assertEquals(isConfirmationExpired(iso, sent + CONFIRMATION_TTL_MS - 1), false);
  assertEquals(isConfirmationExpired(iso, sent + CONFIRMATION_TTL_MS + 1), true);
  assertEquals(isConfirmationExpired(null, sent), true);
});

Deno.test('unsubscribe token round-trips to the subscriber id', async () => {
  const token = await signUnsubscribeToken(ID, SECRET);
  assert(token.startsWith(`${ID}.`));
  assertEquals(await verifyUnsubscribeToken(token, SECRET), ID);
});

Deno.test('unsubscribe token fails with another secret or a swapped id', async () => {
  const token = await signUnsubscribeToken(ID, SECRET);
  assertEquals(await verifyUnsubscribeToken(token, 'other-secret'), null);
  const otherId = '00000000-0000-4000-8000-000000000000';
  const forged = `${otherId}.${token.split('.')[1]}`;
  assertEquals(await verifyUnsubscribeToken(forged, SECRET), null);
});

Deno.test('unsubscribe token rejects junk without throwing', async () => {
  for (const junk of [
    null,
    '',
    'nodot',
    `${ID}.`,
    `${ID}.!!!`,
    'not-a-uuid.abc',
    'x'.repeat(500),
  ]) {
    assertEquals(await verifyUnsubscribeToken(junk, SECRET), null);
  }
  assertEquals(await verifyUnsubscribeToken(await signUnsubscribeToken(ID, SECRET), ''), null);
});
