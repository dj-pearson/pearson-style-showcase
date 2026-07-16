import { describe, it, expect, vi, beforeEach } from 'vitest';

// Shared, hoisted Supabase mock state (rpc + a thenable query builder for from()).
const h = vi.hoisted(() => {
  const state: { fromResult: { data: unknown; error: unknown } } = {
    fromResult: { data: [], error: null },
  };
  const rpc = vi.fn();
  const makeBuilder = () => {
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'update', 'insert', 'delete', 'eq', 'order', 'limit']) {
      b[m] = () => b;
    }
    (b as { then: unknown }).then = (onF: (v: unknown) => unknown, onR: (e: unknown) => unknown) =>
      Promise.resolve(state.fromResult).then(onF, onR);
    return b;
  };
  return { state, rpc, from: vi.fn(() => makeBuilder()) };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: h.rpc, from: h.from },
}));

import {
  generateDeviceFingerprint,
  generateTrustToken,
  getDeviceInfo,
  hashToken,
  storeTrustToken,
  getStoredTrustToken,
  clearTrustToken,
  getCurrentDeviceId,
  trustDevice,
  revokeDeviceTrust,
  getTrustedDevices,
  isDeviceTrusted,
  resetVerificationRateLimit,
} from '../device-trust';

const DAY_MS = 24 * 60 * 60 * 1000;

/** rpc mock that answers verify with a valid record and everything else truthy. */
function mockValidVerification() {
  h.rpc.mockImplementation((name: string) => {
    if (name === 'verify_trust_token') {
      return Promise.resolve({
        data: [{ is_valid: true, device_id: 'device-1', device_name: 'Laptop' }],
        error: null,
      });
    }
    if (name === 'rotate_trust_token') {
      return Promise.resolve({ data: true, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  });
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  h.rpc.mockReset();
  h.state.fromResult = { data: [], error: null };
  resetVerificationRateLimit();
});

describe('device-trust', () => {
  it('generates a consistent 64-char device fingerprint', async () => {
    const a = await generateDeviceFingerprint();
    const b = await generateDeviceFingerprint();
    expect(a).toBe(b); // same browser/device => same fingerprint
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it('generates a namespaced trust token', async () => {
    const token = await generateTrustToken();
    expect(token).toMatch(/^trust_/);
    expect(token.length).toBeGreaterThan(20);
  });

  it('hashToken produces a stable 64-char SHA-256 hex digest', async () => {
    const a = await hashToken('some-token');
    const b = await hashToken('some-token');
    const c = await hashToken('other-token');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it('stores and retrieves a trust record (with last-used timestamp) for a user', async () => {
    await storeTrustToken('hash-abc', 'device-1', 'fp-1', 'user-1');
    // Not stored as plaintext under the legacy key.
    expect(localStorage.getItem('device_trust_token')).toBeNull();

    const stored = await getStoredTrustToken('user-1');
    expect(stored).toMatchObject({ token: 'hash-abc', deviceId: 'device-1', fingerprint: 'fp-1' });
    expect(typeof stored?.lastUsedAt).toBe('number');
  });

  it('trustDevice stores the token HASH, never the raw token', async () => {
    h.rpc.mockResolvedValue({ data: 'device-123', error: null });

    const result = await trustDevice('user-1');
    expect(result.success).toBe(true);

    // The value persisted locally must be a SHA-256 hash, not a trust_ token.
    const stored = await getStoredTrustToken('user-1');
    expect(stored?.token).toMatch(/^[0-9a-f]{64}$/);
    expect(stored?.token.startsWith('trust_')).toBe(false);

    // The same hash (and never a raw token) is what was sent to the database.
    const upsertCall = h.rpc.mock.calls.find((c) => c[0] === 'upsert_trusted_device');
    expect(upsertCall).toBeDefined();
    const sentToken = (upsertCall![1] as { _trust_token: string })._trust_token;
    expect(sentToken).toBe(stored?.token);
    expect(sentToken).toMatch(/^[0-9a-f]{64}$/);

    // No plaintext token in any legacy localStorage slot.
    expect(localStorage.getItem('device_trust_token')).toBeNull();
  });

  it('trusts a device and persists the returned device id', async () => {
    h.rpc.mockResolvedValue({ data: 'device-123', error: null });

    const result = await trustDevice('user-1');
    expect(result.success).toBe(true);
    expect(result.deviceId).toBe('device-123');
    expect(await getCurrentDeviceId('user-1')).toBe('device-123');
  });

  it('revokes trust for a device', async () => {
    h.rpc.mockResolvedValue({ data: true, error: null });
    const result = await revokeDeviceTrust('device-9', 'user-1');
    expect(result.success).toBe(true);
    expect(h.rpc).toHaveBeenCalledWith(
      'revoke_trusted_device',
      expect.objectContaining({ _device_id: 'device-9', _user_id: 'user-1' })
    );
  });

  it('lists multiple trusted devices for a user', async () => {
    h.state.fromResult = {
      data: [
        { id: 'd1', device_name: 'Laptop', is_active: true },
        { id: 'd2', device_name: 'Phone', is_active: true },
      ],
      error: null,
    };
    const result = await getTrustedDevices('user-1');
    expect(result.devices).toHaveLength(2);
    expect(result.devices.map((d) => d.id)).toEqual(['d1', 'd2']);
  });

  it('verifies a trusted device when fingerprint and token match', async () => {
    const fp = await generateDeviceFingerprint();
    const hash = await hashToken('tok-1');
    await storeTrustToken(hash, 'device-1', fp, 'user-1');

    mockValidVerification();

    const result = await isDeviceTrusted('user-1');
    expect(result.trusted).toBe(true);
    expect(result.deviceId).toBe('device-1');
  });

  it('rate limiting blocks rapid verification attempts (max 5 per minute)', async () => {
    const fp = await generateDeviceFingerprint();
    await storeTrustToken(await hashToken('tok'), 'device-1', fp, 'user-1');
    mockValidVerification();

    // 5 allowed, 6th blocked.
    for (let i = 0; i < 5; i++) {
      const r = await isDeviceTrusted('user-1');
      expect(r.trusted).toBe(true);
    }
    const sixth = await isDeviceTrusted('user-1');
    expect(sixth.trusted).toBe(false);

    const verifyCalls = h.rpc.mock.calls.filter((c) => c[0] === 'verify_trust_token');
    expect(verifyCalls).toHaveLength(5); // 6th never reached the DB

    // After resetting the window, verification is allowed again.
    resetVerificationRateLimit();
    const afterReset = await isDeviceTrusted('user-1');
    expect(afterReset.trusted).toBe(true);
  });

  it('rotates the stored token on successful verification and the new token stays valid', async () => {
    const fp = await generateDeviceFingerprint();
    const originalHash = await hashToken('original');
    await storeTrustToken(originalHash, 'device-1', fp, 'user-1');
    mockValidVerification();

    const first = await isDeviceTrusted('user-1');
    expect(first.trusted).toBe(true);

    // Token was rotated to a new hash.
    const afterRotate = await getStoredTrustToken('user-1');
    expect(afterRotate?.token).toMatch(/^[0-9a-f]{64}$/);
    expect(afterRotate?.token).not.toBe(originalHash);

    // rotate_trust_token was called swapping old hash -> new stored hash.
    const rotateCall = h.rpc.mock.calls.find((c) => c[0] === 'rotate_trust_token');
    expect(rotateCall).toBeDefined();
    const args = rotateCall![1] as { _old_trust_token: string; _new_trust_token: string };
    expect(args._old_trust_token).toBe(originalHash);
    expect(args._new_trust_token).toBe(afterRotate?.token);

    // A subsequent verification (sending the rotated hash) still succeeds.
    resetVerificationRateLimit();
    const second = await isDeviceTrusted('user-1');
    expect(second.trusted).toBe(true);
  });

  it('invalidates tokens that have been inactive beyond 14 days', async () => {
    const fp = await generateDeviceFingerprint();
    // Stored 15 days ago -> beyond the 14-day inactivity window.
    await storeTrustToken(
      await hashToken('stale'),
      'device-1',
      fp,
      'user-1',
      Date.now() - 15 * DAY_MS
    );
    mockValidVerification();

    const result = await isDeviceTrusted('user-1');
    expect(result.trusted).toBe(false);

    // Verification never reached the database and the token was cleared.
    const verifyCalls = h.rpc.mock.calls.filter((c) => c[0] === 'verify_trust_token');
    expect(verifyCalls).toHaveLength(0);
    expect(await getStoredTrustToken('user-1')).toBeNull();
  });

  it('a recently-used token within the inactivity window still verifies', async () => {
    const fp = await generateDeviceFingerprint();
    await storeTrustToken(
      await hashToken('fresh'),
      'device-1',
      fp,
      'user-1',
      Date.now() - 2 * DAY_MS
    );
    mockValidVerification();

    const result = await isDeviceTrusted('user-1');
    expect(result.trusted).toBe(true);
  });

  it('clearTrustToken removes stored trust data', async () => {
    await storeTrustToken('hash', 'device-1', 'fp', 'user-1');
    clearTrustToken();
    expect(await getStoredTrustToken('user-1')).toBeNull();
  });

  it('getDeviceInfo derives a browser/OS device name from the user agent', () => {
    const info = getDeviceInfo();
    expect(info).toHaveProperty('deviceName');
    expect(info).toHaveProperty('deviceType');
    expect(typeof info.browser).toBe('string');
  });
});
