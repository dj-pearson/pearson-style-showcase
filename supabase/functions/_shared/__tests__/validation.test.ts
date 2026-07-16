import { assertEquals, assert } from '../test-asserts.ts';
import {
  validateEmail,
  validateUrl,
  validateUuid,
  validateText,
  sanitizeHtml,
} from '../validation.ts';

Deno.test('validateEmail accepts a valid address and normalizes it', () => {
  const result = validateEmail('  User@Example.COM ');
  assertEquals(result.valid, true);
  assertEquals(result.sanitized, 'user@example.com');
});

Deno.test('validateEmail rejects malformed / non-string / empty input', () => {
  assertEquals(validateEmail('not-an-email').valid, false);
  assertEquals(validateEmail('').valid, false);
  assertEquals(validateEmail(42 as unknown).valid, false);
  assertEquals(validateEmail('a@' + 'x'.repeat(300) + '.com').valid, false);
});

Deno.test('validateUrl accepts http/https and rejects other protocols', () => {
  assertEquals(validateUrl('https://danpearson.net/path').valid, true);
  assertEquals(validateUrl('http://example.com').valid, true);
  assertEquals(validateUrl('javascript:alert(1)').valid, false);
  assertEquals(validateUrl('not a url').valid, false);
  assertEquals(validateUrl('').valid, false);
});

Deno.test('validateUuid accepts a valid UUID and lowercases it', () => {
  const upper = '3FA85F64-5717-4562-B3FC-2C963F66AFA6';
  const result = validateUuid(upper);
  assertEquals(result.valid, true);
  assertEquals(result.sanitized, upper.toLowerCase());
  assertEquals(validateUuid('not-a-uuid').valid, false);
});

Deno.test('validateText enforces required and length bounds', () => {
  assertEquals(validateText('', { required: true }).valid, false);
  assertEquals(validateText('hi', { minLength: 3 }).valid, false);
  assertEquals(validateText('toolong', { maxLength: 3 }).valid, false);
  const ok = validateText('  hello  ', { minLength: 2, maxLength: 20 });
  assertEquals(ok.valid, true);
  assertEquals(ok.sanitized, 'hello');
});

Deno.test('sanitizeHtml strips dangerous markup', () => {
  const result = sanitizeHtml('<script>alert(1)</script>hello');
  assert(result.valid);
  const sanitized = String(result.sanitized ?? '');
  assert(!sanitized.toLowerCase().includes('<script'), 'script tag should be removed');
});
