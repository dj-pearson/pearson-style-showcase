import type { Page } from '@playwright/test';
import { webcrypto } from 'node:crypto';

/**
 * Helpers for exercising the admin area in E2E tests without a real backend.
 *
 * AuthContext restores a session from localStorage and then verifies admin
 * access. On restore it first checks an *encrypted* admin cache
 * (`admin_user_cache`, AES-GCM via src/lib/secure-cache.ts); a cache hit sets
 * the auth state straight to `admin_verified` WITHOUT any network call. We
 * exploit that fast path here: seeding a valid session plus a matching
 * encrypted cache yields a fully-authenticated admin. (The slow path calls
 * supabase.auth.getSession() from inside the onAuthStateChange callback, which
 * deadlocks on the supabase-js lock, so the cache route is also the reliable
 * one.)
 *
 * The encrypted blob is produced here in Node with the exact algorithm/params
 * used by secure-cache.ts (PBKDF2 100k / SHA-256 -> AES-GCM 256, IV prefixed,
 * base64), so the app decrypts it transparently.
 */

const SESSION_STORAGE_KEY = 'sb-localhost-auth-token';
const ADMIN_CACHE_KEY = 'admin_user_cache';
const CACHE_SALT_KEY = 'secure_cache_salt';
const PBKDF2_ITERATIONS = 100_000;
const IV_LENGTH = 12;

// A fixed salt (hex string, as secure-cache.ts stores it in sessionStorage).
const SALT_HEX = '00112233445566778899aabbccddeeff';

export const ADMIN_PROFILE = {
  id: 'e2e-admin-id',
  email: 'admin@danpearson.net',
  username: 'admin',
  roles: ['admin'],
  permissions: [
    'manage_articles',
    'manage_projects',
    'manage_accounting',
    'view_dashboard',
  ],
};

async function deriveKey(userId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await webcrypto.subtle.importKey(
    'raw',
    encoder.encode(userId),
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return webcrypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(SALT_HEX),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/** Encrypt a JS value exactly the way secure-cache.ts stores it. */
async function encryptForCache(value: unknown, userId: string): Promise<string> {
  const key = await deriveKey(userId);
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(JSON.stringify(value));
  const iv = webcrypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, dataBuffer);
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return Buffer.from(combined).toString('base64');
}

/**
 * Seed a valid session + a matching encrypted admin cache so the app boots as a
 * fully-verified admin. Must be called before `page.goto`.
 */
export async function seedAdminSession(page: Page): Promise<void> {
  const nowMs = Date.now();
  const nowSeconds = Math.floor(nowMs / 1000);

  const session = {
    access_token: 'e2e-fake-access-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: nowSeconds + 60 * 60 * 24 * 365 * 5,
    refresh_token: 'e2e-fake-refresh-token',
    user: {
      id: ADMIN_PROFILE.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: ADMIN_PROFILE.email,
      app_metadata: { provider: 'email', providers: ['email'] },
      user_metadata: {},
      identities: [],
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    },
  };

  const cachePayload = {
    adminUser: ADMIN_PROFILE,
    userId: ADMIN_PROFILE.id,
    timestamp: nowMs,
  };
  const encryptedCache = await encryptForCache(cachePayload, ADMIN_PROFILE.id);

  await page.addInitScript(
    ({ sessionKey, sessionValue, cacheKey, cacheValue, saltKey, saltValue }) => {
      try {
        localStorage.setItem(sessionKey, sessionValue);
        localStorage.setItem(cacheKey, cacheValue);
        sessionStorage.setItem(saltKey, saltValue);
      } catch {
        /* ignore storage errors */
      }
    },
    {
      sessionKey: SESSION_STORAGE_KEY,
      sessionValue: JSON.stringify(session),
      cacheKey: ADMIN_CACHE_KEY,
      cacheValue: encryptedCache,
      saltKey: CACHE_SALT_KEY,
      saltValue: SALT_HEX,
    }
  );
}

/**
 * Route the admin-auth edge function so any verification/logout call succeeds.
 * `logout` returns success; every other action returns the admin profile.
 * Register before `page.goto`.
 */
export async function mockAdminAuth(page: Page): Promise<void> {
  await page.route('**/functions/v1/admin-auth', async (route) => {
    let action = '';
    try {
      action = (route.request().postDataJSON() as { action?: string })?.action || '';
    } catch {
      /* no JSON body */
    }

    if (action === 'logout') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(ADMIN_PROFILE),
    });
  });
}
