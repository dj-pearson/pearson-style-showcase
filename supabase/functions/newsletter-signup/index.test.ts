import { assertEquals, assert } from '../_shared/test-asserts.ts';
import { validateEmail, DISPOSABLE_DOMAINS } from './validation.ts';

// The signup handler's duplicate detection, storage, and unsubscribe flow are
// Supabase-backed (blocked import). These tests cover the pure email-acceptance
// policy that gates every signup.

Deno.test('accepts a valid email address', () => {
  assertEquals(validateEmail('subscriber@example.com').valid, true);
});

Deno.test('rejects a malformed email address', () => {
  const result = validateEmail('nope');
  assertEquals(result.valid, false);
  assertEquals(result.error, 'Invalid email format');
});

Deno.test('rejects an over-long email address', () => {
  const result = validateEmail('a@' + 'x'.repeat(300) + '.com');
  assertEquals(result.valid, false);
  assertEquals(result.error, 'Email address is too long');
});

Deno.test('rejects disposable email domains', () => {
  assert(DISPOSABLE_DOMAINS.includes('mailinator.com'));
  const result = validateEmail('throwaway@mailinator.com');
  assertEquals(result.valid, false);
  assertEquals(result.error, 'Disposable email addresses are not allowed');
});

Deno.test('normalizes case before validating (uppercase accepted)', () => {
  assertEquals(validateEmail('User@Example.COM').valid, true);
});
