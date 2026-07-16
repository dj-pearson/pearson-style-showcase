import { assertEquals, assert } from '../_shared/test-asserts.ts';
import {
  validateLoginInput,
  isValidEmailFormat,
  isLockedOut,
  MAX_LOGIN_ATTEMPTS,
} from '../_shared/auth-helpers.ts';

// admin-auth's login/whitelist/RBAC flow is Supabase-backed (imported over a URL
// this sandbox blocks), so these tests target the pure security decisions the
// handler relies on: login input validation and the rate-limit lockout
// threshold, both extracted to _shared/auth-helpers.ts.

Deno.test('valid login input passes validation', () => {
  assertEquals(validateLoginInput('admin@example.com', 'hunter2').valid, true);
});

Deno.test('invalid login input is rejected (missing/empty/non-string)', () => {
  assertEquals(validateLoginInput('', 'pw').valid, false);
  assertEquals(validateLoginInput('a@b.com', '').valid, false);
  assertEquals(validateLoginInput(undefined, 'pw').valid, false);
  assertEquals(validateLoginInput('a@b.com', 123 as unknown).valid, false);
  const rejected = validateLoginInput('   ', 'pw');
  assertEquals(rejected.valid, false);
  assert((rejected.error ?? '').length > 0);
});

Deno.test('email format check accepts valid and rejects malformed addresses', () => {
  assert(isValidEmailFormat('user@example.com'));
  assert(!isValidEmailFormat('not-an-email'));
  assert(!isValidEmailFormat('missing@domain'));
});

Deno.test('rate limiting locks out at MAX_LOGIN_ATTEMPTS (5)', () => {
  assertEquals(MAX_LOGIN_ATTEMPTS, 5);
  // Under the limit -> allowed.
  assertEquals(isLockedOut(0), false);
  assertEquals(isLockedOut(4), false);
  // At/over the limit -> locked out.
  assertEquals(isLockedOut(5), true);
  assertEquals(isLockedOut(6), true);
});

Deno.test('lockout threshold is configurable', () => {
  assertEquals(isLockedOut(3, 3), true);
  assertEquals(isLockedOut(2, 3), false);
});
