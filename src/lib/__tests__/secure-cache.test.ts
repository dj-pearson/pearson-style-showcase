import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  secureSet,
  secureGet,
  secureRemove,
  clearCacheSalt,
  isSecureCacheAvailable,
} from '../secure-cache';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('secure-cache', () => {
  it('encrypts and round-trips data for the same user (set/get)', async () => {
    const ok = await secureSet('admin_user', { name: 'Dan', roles: ['admin'] }, 'user-1');
    expect(ok).toBe(true);

    // Stored value is not plaintext.
    expect(localStorage.getItem('admin_user')).not.toContain('Dan');

    const value = await secureGet<{ name: string; roles: string[] }>('admin_user', 'user-1');
    expect(value).toEqual({ name: 'Dan', roles: ['admin'] });
  });

  it('returns null when decrypting with the wrong user id (cache miss)', async () => {
    await secureSet('admin_user', { secret: 42 }, 'user-1');
    const value = await secureGet('admin_user', 'user-2');
    expect(value).toBeNull();
    // Invalid cache is cleaned up.
    expect(localStorage.getItem('admin_user')).toBeNull();
  });

  it('returns null for a missing key', async () => {
    expect(await secureGet('does-not-exist', 'user-1')).toBeNull();
  });

  it('secureRemove deletes cached data', async () => {
    await secureSet('k', { a: 1 }, 'user-1');
    secureRemove('k');
    expect(await secureGet('k', 'user-1')).toBeNull();
  });

  it('reports availability when Web Crypto is present', () => {
    expect(isSecureCacheAvailable()).toBe(true);
  });

  it('degrades gracefully when Web Crypto subtle is unavailable', async () => {
    // Replace crypto with one lacking subtle (getRandomValues only).
    vi.stubGlobal('crypto', {
      getRandomValues: (arr: Uint8Array) => {
        for (let i = 0; i < arr.length; i++) arr[i] = i % 256;
        return arr;
      },
    });

    expect(isSecureCacheAvailable()).toBe(false);
    // secureSet swallows the crypto error and returns false rather than throwing.
    expect(await secureSet('k', { a: 1 }, 'user-1')).toBe(false);
  });

  it('clearCacheSalt removes the derived-key salt', async () => {
    await secureSet('k', { a: 1 }, 'user-1');
    expect(sessionStorage.getItem('secure_cache_salt')).not.toBeNull();
    clearCacheSalt();
    expect(sessionStorage.getItem('secure_cache_salt')).toBeNull();
  });
});
