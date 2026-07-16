import { assertEquals, assert } from '../_shared/test-asserts.ts';
import { validateClickInput } from './validation.ts';

// A tracked click identifies an article (UUID) and an Amazon ASIN. Persistence
// and rate limiting (shared limiter, covered elsewhere) are Supabase-backed;
// these tests cover the input validation that guards every recorded click.

const VALID_UUID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

Deno.test('accepts a valid articleId + asin', () => {
  const result = validateClickInput(VALID_UUID, 'B0ABCD1234');
  assertEquals(result.valid, true);
});

Deno.test('rejects an invalid articleId (not a UUID)', () => {
  const result = validateClickInput('not-a-uuid', 'B0ABCD1234');
  assertEquals(result.valid, false);
  if (!result.valid) assert(result.error.includes('articleId'));
});

Deno.test('rejects a missing / empty asin', () => {
  const result = validateClickInput(VALID_UUID, '');
  assertEquals(result.valid, false);
  if (!result.valid) assert(result.error.includes('asin'));
});

Deno.test('rejects an over-long asin (> 20 chars)', () => {
  const result = validateClickInput(VALID_UUID, 'X'.repeat(25));
  assertEquals(result.valid, false);
});
