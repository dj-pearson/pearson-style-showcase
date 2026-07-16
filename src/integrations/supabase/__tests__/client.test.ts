import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  proxyAuthFetch,
  isApiReachable,
  resetAuthProxyCircuit,
} from '../client';

const AUTH_URL = 'http://localhost:54321/auth/v1/token?grant_type=password';
const COOLDOWN_MS = 30_000;

function failFetch() {
  return vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
}

beforeEach(() => {
  resetAuthProxyCircuit();
  localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('proxyAuthFetch circuit breaker (US-063)', () => {
  it('opens the circuit after MAX failures and fails fast during the cooldown', async () => {
    const fetchMock = failFetch();
    vi.stubGlobal('fetch', fetchMock);

    // Five consecutive network failures trip the breaker.
    for (let i = 0; i < 5; i++) {
      await expect(proxyAuthFetch(AUTH_URL, {})).rejects.toThrow();
    }
    expect(isApiReachable()).toBe(false);
    const callsWhenOpened = fetchMock.mock.calls.length;

    // The next request during the cooldown fails fast WITHOUT attempting a fetch.
    await expect(proxyAuthFetch(AUTH_URL, {})).rejects.toThrow(/temporarily unreachable/i);
    expect(fetchMock.mock.calls.length).toBe(callsWhenOpened);
  });

  it('reopens (half-open) after the cooldown and closes on a successful probe', async () => {
    const realNow = Date.now;
    let now = 1_000_000;
    globalThis.Date.now = () => now;

    try {
      const fetchMock = failFetch();
      vi.stubGlobal('fetch', fetchMock);
      for (let i = 0; i < 5; i++) {
        await expect(proxyAuthFetch(AUTH_URL, {})).rejects.toThrow();
      }
      expect(isApiReachable()).toBe(false);

      // Advance time past the cooldown window: the next request is a half-open probe.
      now += COOLDOWN_MS + 1;

      const okMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
      vi.stubGlobal('fetch', okMock);

      const res = await proxyAuthFetch(AUTH_URL, {});
      expect(okMock).toHaveBeenCalledTimes(1); // the probe actually reached the network
      expect(res.status).toBe(200);
      expect(isApiReachable()).toBe(true); // circuit closed again
    } finally {
      globalThis.Date.now = realNow;
    }
  });

  it('clears stale tokens once on the initial trip, not on every failed probe', async () => {
    const realNow = Date.now;
    let now = 5_000_000;
    globalThis.Date.now = () => now;

    try {
      localStorage.setItem('sb-test-auth-token', 'stale');
      const fetchMock = failFetch();
      vi.stubGlobal('fetch', fetchMock);

      for (let i = 0; i < 5; i++) {
        await expect(proxyAuthFetch(AUTH_URL, {})).rejects.toThrow();
      }
      // Initial trip cleared the stale token.
      expect(localStorage.getItem('sb-test-auth-token')).toBeNull();

      // A later failed probe (after cooldown) must not permanently block recovery:
      // the circuit re-opens with a fresh cooldown rather than staying latched.
      now += COOLDOWN_MS + 1;
      await expect(proxyAuthFetch(AUTH_URL, {})).rejects.toThrow(/Failed to fetch/);
      expect(isApiReachable()).toBe(false);

      // Still recoverable: after another cooldown a success closes the circuit.
      now += COOLDOWN_MS + 1;
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 200 })));
      const res = await proxyAuthFetch(AUTH_URL, {});
      expect(res.status).toBe(200);
      expect(isApiReachable()).toBe(true);
    } finally {
      globalThis.Date.now = realNow;
    }
  });
});
