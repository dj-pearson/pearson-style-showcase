/**
 * SSRF guard for edge functions that fetch caller-supplied URLs.
 *
 * Hostname regexes are not enough: a name can resolve to 127.0.0.1, an IP can
 * be spelled as 2130706433 or 0x7f.1, and a public URL can redirect to the
 * cloud metadata endpoint. assertPublicUrl resolves the host and checks every
 * address it gets back; safeFetch follows redirects by hand and re-checks each
 * hop.
 *
 * Known gap: the address checked here and the one fetch() connects to come
 * from separate lookups, so a DNS-rebinding host with a near-zero TTL can
 * still slip through. Closing that needs connecting to the vetted IP directly,
 * which Deno's fetch does not expose.
 */

export class UrlGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UrlGuardError';
  }
}

/**
 * Parse an IPv4 literal the way inet_aton does: 1 to 4 dot-separated parts,
 * each decimal, hex (0x..) or octal (leading 0), with the last part filling
 * the remaining bytes. Returns the address as an unsigned 32-bit number, or
 * null when the string is not an IPv4 literal.
 */
export function parseIPv4(host: string): number | null {
  const parts = host.split('.');
  if (parts.length === 0 || parts.length > 4) return null;

  const values: number[] = [];
  for (const part of parts) {
    let value: number;
    if (/^0x[0-9a-f]*$/i.test(part)) {
      value = part.length === 2 ? 0 : parseInt(part.slice(2), 16);
    } else if (/^0[0-7]+$/.test(part)) {
      value = parseInt(part.slice(1), 8);
    } else if (/^(0|[1-9][0-9]*)$/.test(part)) {
      value = parseInt(part, 10);
    } else {
      return null;
    }
    if (!Number.isFinite(value)) return null;
    values.push(value);
  }

  const last = values.pop()!;
  for (const v of values) {
    if (v > 255) return null;
  }
  const lastMax = 2 ** (8 * (4 - values.length)) - 1;
  if (last > lastMax) return null;

  let result = 0;
  values.forEach((v, i) => {
    result += v * 2 ** (8 * (3 - i));
  });
  return result + last;
}

function inV4Range(addr: number, base: string, bits: number): boolean {
  const baseNum = parseIPv4(base)!;
  const size = 2 ** (32 - bits);
  return Math.floor(addr / size) === Math.floor(baseNum / size);
}

const BLOCKED_V4: Array<[string, number]> = [
  ['0.0.0.0', 8], // "this network"
  ['10.0.0.0', 8], // private
  ['100.64.0.0', 10], // CGNAT
  ['127.0.0.0', 8], // loopback
  ['169.254.0.0', 16], // link-local, cloud metadata
  ['172.16.0.0', 12], // private
  ['192.0.0.0', 24], // IETF protocol assignments
  ['192.168.0.0', 16], // private
  ['198.18.0.0', 15], // benchmarking
  ['224.0.0.0', 4], // multicast
  ['240.0.0.0', 4], // reserved, includes broadcast
];

export function isBlockedIPv4(addr: number): boolean {
  return BLOCKED_V4.some(([base, bits]) => inV4Range(addr, base, bits));
}

/**
 * Parse an IPv6 literal (brackets and zone id allowed) into 8 hextets, or null
 * when the string is not IPv6. Handles "::" compression and a dotted IPv4 tail.
 */
export function parseIPv6(input: string): number[] | null {
  let host = input;
  if (host.startsWith('[') && host.endsWith(']')) host = host.slice(1, -1);
  const zone = host.indexOf('%');
  if (zone !== -1) host = host.slice(0, zone);
  if (!host.includes(':')) return null;

  // Rewrite a dotted IPv4 tail (::ffff:127.0.0.1) as two hex groups.
  const lastColon = host.lastIndexOf(':');
  const lastPart = host.slice(lastColon + 1);
  if (lastPart.includes('.')) {
    if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(lastPart)) return null;
    const v4 = parseIPv4(lastPart);
    if (v4 === null) return null;
    const hi = Math.floor(v4 / 65536).toString(16);
    const lo = (v4 % 65536).toString(16);
    host = `${host.slice(0, lastColon + 1)}${hi}:${lo}`;
  }

  const halves = host.split('::');
  if (halves.length > 2) return null;

  const toGroups = (s: string): number[] | null => {
    if (s === '') return [];
    const groups: number[] = [];
    for (const g of s.split(':')) {
      if (!/^[0-9a-f]{1,4}$/i.test(g)) return null;
      groups.push(parseInt(g, 16));
    }
    return groups;
  };

  const head = toGroups(halves[0]);
  const rest = halves.length === 2 ? toGroups(halves[1]) : [];
  if (head === null || rest === null) return null;

  const explicit = head.length + rest.length;
  if (halves.length === 1) {
    return explicit === 8 ? head : null;
  }
  if (explicit > 7) return null;
  const zeros = new Array(8 - explicit).fill(0);
  return [...head, ...zeros, ...rest];
}

export function isBlockedIPv6(h: number[]): boolean {
  const allZeroPrefix = (n: number) => h.slice(0, n).every((g) => g === 0);

  // :: (unspecified) and ::1 (loopback)
  if (allZeroPrefix(7) && (h[7] === 0 || h[7] === 1)) return true;
  // ::ffff:0:0/96 IPv4-mapped; reject outright rather than trust the v4 part
  if (allZeroPrefix(5) && h[5] === 0xffff) return true;
  // ::/96 deprecated IPv4-compatible form
  if (allZeroPrefix(6)) return true;
  // fc00::/7 unique local
  if ((h[0] & 0xfe00) === 0xfc00) return true;
  // fe80::/10 link-local
  if ((h[0] & 0xffc0) === 0xfe80) return true;
  // fec0::/10 deprecated site-local
  if ((h[0] & 0xffc0) === 0xfec0) return true;
  // ff00::/8 multicast
  if ((h[0] & 0xff00) === 0xff00) return true;
  // 64:ff9b::/96 NAT64: blocked when the embedded IPv4 address is
  if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((g) => g === 0)) {
    return isBlockedIPv4(h[6] * 65536 + h[7]);
  }
  return false;
}

/**
 * True when `ip` is an address the server must not connect to. Anything that
 * parses as neither IPv4 nor IPv6 is treated as blocked (fail closed).
 */
export function isBlockedIp(ip: string): boolean {
  const v4 = parseIPv4(ip);
  if (v4 !== null) return isBlockedIPv4(v4);
  const v6 = parseIPv6(ip);
  if (v6 !== null) return isBlockedIPv6(v6);
  return true;
}

/** True when the hostname is written as an IP literal rather than a name. */
export function isIpLiteral(hostname: string): boolean {
  return parseIPv4(hostname) !== null || parseIPv6(hostname) !== null;
}

async function resolveAll(hostname: string): Promise<string[]> {
  const lookups = await Promise.allSettled([
    Deno.resolveDns(hostname, 'A'),
    Deno.resolveDns(hostname, 'AAAA'),
  ]);
  return lookups.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
}

/**
 * Throw UrlGuardError unless `input` is an http(s) URL whose host resolves
 * only to public addresses. Returns the parsed URL.
 */
export async function assertPublicUrl(input: string | URL): Promise<URL> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UrlGuardError('Invalid URL');
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new UrlGuardError('Only http and https URLs are allowed');
  }
  if (url.username || url.password) {
    throw new UrlGuardError('URLs with credentials are not allowed');
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!hostname || hostname === 'localhost' || hostname.endsWith('.localhost')) {
    throw new UrlGuardError('URL points to a private or internal address');
  }

  if (isIpLiteral(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new UrlGuardError('URL points to a private or internal address');
    }
    return url;
  }

  const addresses = await resolveAll(hostname);
  if (addresses.length === 0) {
    throw new UrlGuardError('URL host could not be resolved');
  }
  if (addresses.some(isBlockedIp)) {
    throw new UrlGuardError('URL points to a private or internal address');
  }
  return url;
}

/**
 * fetch() that refuses non-public destinations, including ones reached through
 * a redirect. Redirects are followed manually up to `maxRedirects` times.
 */
export async function safeFetch(
  input: string | URL,
  init: RequestInit = {},
  maxRedirects = 3
): Promise<Response> {
  let current = await assertPublicUrl(input);
  let requestInit: RequestInit = { ...init, redirect: 'manual' };

  for (let hop = 0; ; hop++) {
    const response = await fetch(current, requestInit);

    const location = response.headers.get('location');
    if (response.status < 300 || response.status >= 400 || !location) {
      return response;
    }
    // Release the redirect body before following.
    await response.body?.cancel();

    if (hop >= maxRedirects) {
      throw new UrlGuardError(`Too many redirects (max ${maxRedirects})`);
    }

    current = await assertPublicUrl(new URL(location, current));

    // Match browser semantics: 303, and 301/302 after POST, become a bodyless GET.
    const method = (requestInit.method ?? 'GET').toUpperCase();
    if (
      response.status === 303 ||
      ((response.status === 301 || response.status === 302) && method === 'POST')
    ) {
      requestInit = { ...requestInit, method: 'GET', body: undefined };
    }
  }
}
