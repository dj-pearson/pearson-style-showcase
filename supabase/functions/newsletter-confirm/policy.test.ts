import { assertEquals } from '../_shared/test-asserts.ts';
import { CONFIRMATION_TTL_MS } from '../_shared/newsletter-tokens.ts';
import { decideConfirmAction, type PendingSubscriber, wonConfirmRace } from './policy.ts';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const row = (over: Partial<PendingSubscriber>): PendingSubscriber => ({
  active: false,
  confirmed_at: null,
  confirmation_sent_at: ago(60_000),
  ...over,
});

Deno.test('a token that matches no row is invalid', () => {
  assertEquals(decideConfirmAction(null, NOW), 'invalid');
});

Deno.test('a pending row mailed recently is confirmed', () => {
  assertEquals(decideConfirmAction(row({}), NOW), 'confirm');
});

Deno.test('a second click on a confirmed subscription sends nothing', () => {
  const confirmed = row({ active: true, confirmed_at: ago(1000) });
  assertEquals(decideConfirmAction(confirmed, NOW), 'already_confirmed');
  // Even when the link itself has since expired.
  assertEquals(
    decideConfirmAction({ ...confirmed, confirmation_sent_at: ago(CONFIRMATION_TTL_MS * 2) }, NOW),
    'already_confirmed'
  );
});

Deno.test('a link older than the seven day TTL has expired', () => {
  assertEquals(
    decideConfirmAction(row({ confirmation_sent_at: ago(CONFIRMATION_TTL_MS + 1) }), NOW),
    'expired'
  );
  assertEquals(
    decideConfirmAction(row({ confirmation_sent_at: ago(CONFIRMATION_TTL_MS - 1000) }), NOW),
    'confirm'
  );
});

Deno.test('a row with no or an unparseable send time counts as expired', () => {
  assertEquals(decideConfirmAction(row({ confirmation_sent_at: null }), NOW), 'expired');
  assertEquals(decideConfirmAction(row({ confirmation_sent_at: 'not a date' }), NOW), 'expired');
});

Deno.test('an inactive row is not reported as confirmed, whatever confirmed_at says', () => {
  assertEquals(
    decideConfirmAction(row({ active: false, confirmed_at: ago(1000) }), NOW),
    'confirm'
  );
  assertEquals(decideConfirmAction(row({ active: null }), NOW), 'confirm');
});

Deno.test('only the request whose update matched a row sends the welcome', () => {
  assertEquals(wonConfirmRace([{ id: 'x' }]), true);
  assertEquals(wonConfirmRace([]), false);
  assertEquals(wonConfirmRace(null), false);
  assertEquals(wonConfirmRace(undefined), false);
});
