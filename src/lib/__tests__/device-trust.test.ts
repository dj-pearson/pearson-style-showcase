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
    (b as { then: unknown }).then = (
      onF: (v: unknown) => unknown,
      onR: (e: unknown) => unknown
    ) => Promise.resolve(state.fromResult).then(onF, onR);
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
  storeTrustToken,
  getStoredTrustToken,
  clearTrustToken,
  getCurrentDeviceId,
  trustDevice,
  revokeDeviceTrust,
  getTrustedDevices,
  isDeviceTrusted,
} from '../device-trust';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  h.rpc.mockReset();
  h.state.fromResult = { data: [], error: null };
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

  it('stores and retrieves an (encrypted) trust token for a user', async () => {
    await storeTrustToken('tok-abc', 'device-1', 'fp-1', 'user-1');
    // Not stored as plaintext under the legacy key.
    expect(localStorage.getItem('device_trust_token')).toBeNull();

    const stored = await getStoredTrustToken('user-1');
    expect(stored).toEqual({ token: 'tok-abc', deviceId: 'device-1', fingerprint: 'fp-1' });
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
    await storeTrustToken('tok-1', 'device-1', fp, 'user-1');

    h.rpc.mockImplementation((name: string) =>
      name === 'verify_trust_token'
        ? Promise.resolve({
            data: [{ is_valid: true, device_id: 'device-1', device_name: 'Laptop' }],
            error: null,
          })
        : Promise.resolve({ data: null, error: null })
    );

    const result = await isDeviceTrusted('user-1');
    expect(result.trusted).toBe(true);
    expect(result.deviceId).toBe('device-1');
  });

  it('clearTrustToken removes stored trust data', async () => {
    await storeTrustToken('tok', 'device-1', 'fp', 'user-1');
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
