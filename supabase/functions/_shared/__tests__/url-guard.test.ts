import { assertEquals, assert } from '../test-asserts.ts';
import { isBlockedIp, isIpLiteral, parseIPv4, parseIPv6 } from '../url-guard.ts';

Deno.test('parseIPv4 reads dotted decimal', () => {
  assertEquals(parseIPv4('127.0.0.1'), 0x7f000001);
  assertEquals(parseIPv4('8.8.8.8'), 0x08080808);
});

Deno.test('parseIPv4 reads decimal, hex and octal spellings of the same address', () => {
  assertEquals(parseIPv4('2130706433'), 0x7f000001);
  assertEquals(parseIPv4('0x7f000001'), 0x7f000001);
  assertEquals(parseIPv4('0x7f.0.0.1'), 0x7f000001);
  assertEquals(parseIPv4('0177.0.0.1'), 0x7f000001);
  assertEquals(parseIPv4('127.1'), 0x7f000001);
});

Deno.test('parseIPv4 rejects names and out-of-range parts', () => {
  assertEquals(parseIPv4('danpearson.net'), null);
  assertEquals(parseIPv4('256.0.0.1'), null);
  assertEquals(parseIPv4('1.2.3.4.5'), null);
  assertEquals(parseIPv4('1.2.3.'), null);
  assertEquals(parseIPv4('4294967296'), null);
});

Deno.test('parseIPv6 expands compressed forms and dotted tails', () => {
  assertEquals(parseIPv6('::1'), [0, 0, 0, 0, 0, 0, 0, 1]);
  assertEquals(parseIPv6('[fe80::1%eth0]'), [0xfe80, 0, 0, 0, 0, 0, 0, 1]);
  assertEquals(parseIPv6('::ffff:127.0.0.1'), [0, 0, 0, 0, 0, 0xffff, 0x7f00, 1]);
  assertEquals(parseIPv6('2606:4700::1111'), [0x2606, 0x4700, 0, 0, 0, 0, 0, 0x1111]);
});

Deno.test('parseIPv6 rejects malformed input', () => {
  assertEquals(parseIPv6('1::2::3'), null);
  assertEquals(parseIPv6('1:2:3:4:5:6:7'), null);
  assertEquals(parseIPv6('gggg::1'), null);
  assertEquals(parseIPv6('example.com'), null);
});

Deno.test('isBlockedIp blocks private, loopback, link-local, CGNAT and zero ranges', () => {
  for (const ip of [
    '10.0.0.1',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '127.0.0.1',
    '169.254.169.254',
    '100.64.0.1',
    '100.127.255.255',
    '0.0.0.0',
    '0.1.2.3',
  ]) {
    assert(isBlockedIp(ip), `${ip} should be blocked`);
  }
});

Deno.test('isBlockedIp blocks encoded forms of loopback and metadata addresses', () => {
  assert(isBlockedIp('2130706433'));
  assert(isBlockedIp('0x7f000001'));
  assert(isBlockedIp('0251.0376.0251.0376')); // 169.254.169.254 in octal
});

Deno.test('isBlockedIp blocks IPv6 loopback, ULA, link-local and IPv4-mapped', () => {
  for (const ip of [
    '::1',
    '::',
    'fc00::1',
    'fd12:3456::1',
    'fe80::1',
    'febf::1',
    '::ffff:127.0.0.1',
    '::ffff:8.8.8.8',
    '[::1]',
  ]) {
    assert(isBlockedIp(ip), `${ip} should be blocked`);
  }
});

Deno.test('isBlockedIp allows public addresses at range edges', () => {
  for (const ip of [
    '8.8.8.8',
    '1.1.1.1',
    '172.15.255.255',
    '172.32.0.0',
    '100.63.255.255',
    '100.128.0.0',
    '192.169.0.1',
    '2606:4700:4700::1111',
    'fbff::1',
    'fe00::1',
  ]) {
    assert(!isBlockedIp(ip), `${ip} should be allowed`);
  }
});

Deno.test('isBlockedIp fails closed on input that is not an address', () => {
  assert(isBlockedIp('not-an-ip'));
  assert(isBlockedIp(''));
});

Deno.test('isIpLiteral separates literals from hostnames', () => {
  assert(isIpLiteral('127.0.0.1'));
  assert(isIpLiteral('[::1]'));
  assert(!isIpLiteral('danpearson.net'));
});
