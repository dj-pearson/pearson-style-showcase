import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { verifyOAuthState } from '../oauth-state';

// oauth-state.ts only exports verification; the state is written by the OAuth
// start flow. These helpers mirror that storage format and binding hash.
const KEYS = {
  state: 'oauth_state',
  meta: 'oauth_state_meta',
  expiry: 'oauth_state_expiry',
  used: 'oauth_state_used',
};

async function bindingHash(random: string, provider: string, redirectTo: string, csrf: string) {
  const data = new TextEncoder().encode(`${random}|${provider}|${redirectTo}|${csrf}`);
  const buf = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
  return btoa(String.fromCharCode(...buf))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const META = {
  provider: 'google',
  redirectTo: 'https://danpearson.net/admin/dashboard',
  csrfToken: 'csrf-token-123',
  createdAt: Date.now(),
};

async function storeState(
  opts: { meta?: typeof META; expiry?: number | string; random?: string } = {}
): Promise<string> {
  const meta = opts.meta ?? META;
  const random = opts.random ?? 'randomPart123';
  const state = `${random}.${await bindingHash(random, meta.provider, meta.redirectTo, meta.csrfToken)}`;
  sessionStorage.setItem(KEYS.state, state);
  sessionStorage.setItem(KEYS.meta, JSON.stringify(meta));
  sessionStorage.setItem(KEYS.expiry, String(opts.expiry ?? Date.now() + 10 * 60 * 1000));
  return state;
}

function storageEmpty() {
  return Object.values(KEYS).every((k) => sessionStorage.getItem(k) === null);
}

describe('verifyOAuthState', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    sessionStorage.clear();
  });

  it('accepts a valid state bound to provider and redirect, then clears storage', async () => {
    const state = await storeState();
    await expect(verifyOAuthState(state, 'google', META.redirectTo)).resolves.toEqual({
      valid: true,
    });
    expect(storageEmpty()).toBe(true);
  });

  it('accepts a valid state when redirect is omitted', async () => {
    const state = await storeState();
    await expect(verifyOAuthState(state, 'google')).resolves.toEqual({ valid: true });
  });

  it('accepts legacy flow with no provider (state comparison only)', async () => {
    const state = await storeState();
    await expect(verifyOAuthState(state)).resolves.toEqual({ valid: true });
  });

  it('rejects a replay of an already verified state', async () => {
    const state = await storeState();
    await verifyOAuthState(state, 'google');
    await expect(verifyOAuthState(state, 'google')).resolves.toEqual({
      valid: false,
      error: 'No stored state found or state expired',
    });
  });

  describe('missing', () => {
    it('rejects a null received state', async () => {
      await storeState();
      await expect(verifyOAuthState(null, 'google')).resolves.toEqual({
        valid: false,
        error: 'No state parameter in callback',
      });
    });

    it('rejects when nothing is stored', async () => {
      await expect(verifyOAuthState('abc.def', 'google')).resolves.toEqual({
        valid: false,
        error: 'No stored state found or state expired',
      });
    });

    it('rejects and clears when metadata is missing', async () => {
      const state = await storeState();
      sessionStorage.removeItem(KEYS.meta);
      const r = await verifyOAuthState(state, 'google');
      expect(r.valid).toBe(false);
      expect(storageEmpty()).toBe(true);
    });
  });

  describe('expired', () => {
    it('rejects a state past its expiry and clears storage', async () => {
      const state = await storeState({ expiry: Date.now() - 1 });
      await expect(verifyOAuthState(state, 'google')).resolves.toEqual({
        valid: false,
        error: 'No stored state found or state expired',
      });
      expect(storageEmpty()).toBe(true);
    });

    it('rejects a non-numeric expiry', async () => {
      const state = await storeState({ expiry: 'not-a-number' });
      const r = await verifyOAuthState(state, 'google');
      expect(r.valid).toBe(false);
    });

    it('rejects a state marked used more than 30s ago', async () => {
      const state = await storeState();
      sessionStorage.setItem(KEYS.used, String(Date.now() - 31 * 1000));
      const r = await verifyOAuthState(state, 'google');
      expect(r).toEqual({ valid: false, error: 'No stored state found or state expired' });
      expect(storageEmpty()).toBe(true);
    });

    it('allows a state marked used within the 30s grace period', async () => {
      const state = await storeState();
      sessionStorage.setItem(KEYS.used, String(Date.now() - 5 * 1000));
      await expect(verifyOAuthState(state, 'google')).resolves.toEqual({ valid: true });
    });
  });

  describe('tampered', () => {
    it('rejects a received state that differs from the stored one', async () => {
      const state = await storeState();
      const tampered = state.slice(0, -1) + (state.endsWith('A') ? 'B' : 'A');
      await expect(verifyOAuthState(tampered, 'google')).resolves.toEqual({
        valid: false,
        error: 'State parameter mismatch',
      });
      expect(storageEmpty()).toBe(true);
    });

    it('rejects a different-length state', async () => {
      const state = await storeState();
      const r = await verifyOAuthState(state + 'x', 'google');
      expect(r).toEqual({ valid: false, error: 'State parameter mismatch' });
    });

    it('rejects a state bound to a different provider', async () => {
      const state = await storeState();
      await expect(verifyOAuthState(state, 'github')).resolves.toEqual({
        valid: false,
        error: 'State parameter bound to different provider',
      });
    });

    it('rejects a state bound to a different redirect', async () => {
      const state = await storeState();
      await expect(
        verifyOAuthState(state, 'google', 'https://evil.example/callback')
      ).resolves.toEqual({
        valid: false,
        error: 'State parameter bound to different redirect',
      });
    });

    it('rejects when stored metadata no longer matches the binding hash', async () => {
      const state = await storeState();
      sessionStorage.setItem(KEYS.meta, JSON.stringify({ ...META, csrfToken: 'forged' }));
      await expect(verifyOAuthState(state, 'google')).resolves.toEqual({
        valid: false,
        error: 'State binding verification failed',
      });
      expect(storageEmpty()).toBe(true);
    });

    it('rejects and clears when metadata is not valid JSON', async () => {
      const state = await storeState();
      sessionStorage.setItem(KEYS.meta, '{not json');
      const r = await verifyOAuthState(state, 'google');
      expect(r.valid).toBe(false);
      expect(storageEmpty()).toBe(true);
    });
  });
});
