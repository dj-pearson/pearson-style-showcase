import { assertEquals, assert } from '../test-asserts.ts';
import { parseBearerToken, safeEqual } from '../require-admin-helpers.ts';

Deno.test('parseBearerToken extracts the token from a Bearer header', () => {
  assertEquals(parseBearerToken('Bearer abc.def.ghi'), 'abc.def.ghi');
});

Deno.test('parseBearerToken is case-insensitive on the scheme', () => {
  assertEquals(parseBearerToken('bearer abc'), 'abc');
  assertEquals(parseBearerToken('BEARER abc'), 'abc');
});

Deno.test('parseBearerToken accepts a bare token without the scheme', () => {
  assertEquals(parseBearerToken('abc.def.ghi'), 'abc.def.ghi');
});

Deno.test('parseBearerToken returns null for absent or empty credentials', () => {
  assertEquals(parseBearerToken(null), null);
  assertEquals(parseBearerToken(''), null);
  assertEquals(parseBearerToken('Bearer '), null);
  assertEquals(parseBearerToken('   '), null);
});

Deno.test('safeEqual matches identical strings', () => {
  assert(safeEqual('service-role-key', 'service-role-key'));
  assert(safeEqual('', ''));
});

Deno.test('safeEqual rejects differing strings of equal length', () => {
  assert(!safeEqual('abcd', 'abce'));
  // Difference in the first character must not be treated differently from
  // a difference in the last: the loop is not allowed to short-circuit.
  assert(!safeEqual('xbcd', 'abcd'));
});

Deno.test('safeEqual rejects differing lengths, including prefixes', () => {
  assert(!safeEqual('abc', 'abcd'));
  assert(!safeEqual('abcd', 'abc'));
  assert(!safeEqual('', 'a'));
});
