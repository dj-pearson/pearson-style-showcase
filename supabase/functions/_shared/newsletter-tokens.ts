/**
 * Tokens for the newsletter double opt-in and unsubscribe links (US-107).
 *
 * Confirmation: a random 256-bit token goes in the emailed link; only its
 * SHA-256 hash is stored (newsletter_subscribers.confirmation_token_hash).
 *
 * Unsubscribe: `<subscriber id>.<HMAC-SHA256(secret, "unsubscribe:" + id)>`,
 * keyed with NEWSLETTER_TOKEN_SECRET. Needs no column and never expires, so a
 * link in a two-year-old email still works.
 *
 * Web Crypto only, no imports, so the Deno tests can run offline.
 */

export const CONFIRMATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const CONFIRMATION_RESEND_COOLDOWN_MS = 10 * 60 * 1000;

const encoder = new TextEncoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(input: string) {
  if (!/^[A-Za-z0-9_-]*$/.test(input)) return null;
  const b64 = input.replace(/-/g, '+').replace(/_/g, '/');
  try {
    const binary = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

// 32 random bytes in unpadded base64url.
const CONFIRMATION_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True when the string has the shape of a token this module issued. */
export function isWellFormedConfirmationToken(token: unknown): token is string {
  return typeof token === 'string' && CONFIRMATION_TOKEN_PATTERN.test(token);
}

/** Hex SHA-256 of a token, as stored in confirmation_token_hash. */
export async function hashToken(token: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(token)));
  return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('');
}

/** A fresh confirmation token and the hash to store for it. */
export async function generateConfirmationToken(): Promise<{ token: string; hash: string }> {
  const token = bytesToBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  return { token, hash: await hashToken(token) };
}

/** A token mailed at `sentAt` is dead once seven days have passed. */
export function isConfirmationExpired(sentAt: string | null, now: number = Date.now()): boolean {
  if (!sentAt) return true;
  const sent = Date.parse(sentAt);
  return Number.isNaN(sent) || now - sent > CONFIRMATION_TTL_MS;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

function unsubscribeMessage(subscriberId: string) {
  return encoder.encode(`unsubscribe:${subscriberId.toLowerCase()}`);
}

/** The token that goes in a subscriber's unsubscribe links. */
export async function signUnsubscribeToken(subscriberId: string, secret: string): Promise<string> {
  if (!secret) throw new Error('NEWSLETTER_TOKEN_SECRET is not set');
  const sig = await crypto.subtle.sign(
    'HMAC',
    await hmacKey(secret),
    unsubscribeMessage(subscriberId)
  );
  return `${subscriberId.toLowerCase()}.${bytesToBase64Url(new Uint8Array(sig))}`;
}

/**
 * The subscriber id an unsubscribe token was signed for, or null when the
 * token is malformed or the signature doesn't match. crypto.subtle.verify
 * compares in constant time.
 */
export async function verifyUnsubscribeToken(
  token: unknown,
  secret: string
): Promise<string | null> {
  if (!secret || typeof token !== 'string' || token.length > 200) return null;
  const dot = token.indexOf('.');
  if (dot < 0) return null;
  const id = token.slice(0, dot);
  if (!UUID_PATTERN.test(id)) return null;
  const sig = base64UrlToBytes(token.slice(dot + 1));
  if (!sig || sig.length !== 32) return null;
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), sig, unsubscribeMessage(id));
  return ok ? id.toLowerCase() : null;
}
