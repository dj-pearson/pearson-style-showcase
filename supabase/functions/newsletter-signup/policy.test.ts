import { assertEquals } from '../_shared/test-asserts.ts';
import { decideSignupAction, type ExistingSubscriber } from './policy.ts';

const NOW = Date.parse('2026-11-15T12:00:00Z');
const minutesAgo = (m: number) => new Date(NOW - m * 60_000).toISOString();
const row = (over: Partial<ExistingSubscriber>): ExistingSubscriber => ({
  id: 'id',
  active: false,
  confirmed_at: null,
  confirmation_sent_at: null,
  ...over,
});

Deno.test('a new address gets a pending row and a confirmation', () => {
  assertEquals(decideSignupAction(null, NOW), 'insert');
});

Deno.test('a confirmed subscriber is told so and gets no mail', () => {
  assertEquals(
    decideSignupAction(row({ active: true, confirmed_at: minutesAgo(9000) }), NOW),
    'already_subscribed'
  );
});

Deno.test('a pending address is resent at most once per 10 minutes', () => {
  assertEquals(decideSignupAction(row({ confirmation_sent_at: minutesAgo(3) }), NOW), 'cooldown');
  assertEquals(decideSignupAction(row({ confirmation_sent_at: minutesAgo(11) }), NOW), 'resend');
});

Deno.test('an unsubscribed address must confirm again, never silently reactivated', () => {
  assertEquals(
    decideSignupAction(row({ active: false, confirmed_at: minutesAgo(9000) }), NOW),
    'resend'
  );
});
