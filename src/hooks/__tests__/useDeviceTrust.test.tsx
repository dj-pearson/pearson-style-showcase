import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { createMockAuthValue } from '@/test/test-utils';
import type { User } from '@supabase/supabase-js';

// Mock the device-trust library the hook delegates to.
vi.mock('@/lib/device-trust', () => ({
  isDeviceTrusted: vi.fn(),
  trustDevice: vi.fn(),
  revokeDeviceTrust: vi.fn(),
  revokeAllDeviceTrust: vi.fn(),
  getTrustedDevices: vi.fn(),
  getCurrentDeviceId: vi.fn(),
  getFullDeviceInfo: vi.fn(),
}));

import {
  isDeviceTrusted,
  trustDevice,
  revokeDeviceTrust,
  getCurrentDeviceId,
  getFullDeviceInfo,
} from '@/lib/device-trust';
import { useDeviceTrust } from '../useDeviceTrust';

const mockUser = { id: 'user-1', email: 'a@b.com' } as unknown as User;

function authWrapper(authenticated = true) {
  const value = createMockAuthValue({
    user: authenticated ? mockUser : null,
    isAuthenticated: authenticated,
  });
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

const deviceInfo = {
  deviceName: 'Test Device',
  browser: 'Chrome',
  os: 'Linux',
  fingerprint: 'fp-123',
} as unknown as Awaited<ReturnType<typeof getFullDeviceInfo>>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getFullDeviceInfo).mockResolvedValue(deviceInfo);
  vi.mocked(isDeviceTrusted).mockResolvedValue({ trusted: false });
});

describe('useDeviceTrust', () => {
  it('reports a trusted device after verification (happy path)', async () => {
    vi.mocked(isDeviceTrusted).mockResolvedValue({
      trusted: true,
      deviceId: 'device-9',
      deviceName: 'My Laptop',
    });

    const { result } = renderHook(() => useDeviceTrust(), { wrapper: authWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isTrusted).toBe(true);
    expect(result.current.currentDeviceId).toBe('device-9');
    expect(result.current.currentDeviceName).toBe('My Laptop');
  });

  it('reports an untrusted/expired device as not trusted (edge case)', async () => {
    vi.mocked(isDeviceTrusted).mockResolvedValue({ trusted: false });

    const { result } = renderHook(() => useDeviceTrust(), { wrapper: authWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isTrusted).toBe(false);
    expect(result.current.currentDeviceId).toBeNull();
  });

  it('does not check trust and is not loading when unauthenticated', async () => {
    const { result } = renderHook(() => useDeviceTrust(), { wrapper: authWrapper(false) });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isTrusted).toBe(false);
    expect(isDeviceTrusted).not.toHaveBeenCalled();
  });

  it('trusts the current device and generates the fingerprint/device name', async () => {
    vi.mocked(trustDevice).mockResolvedValue({ success: true, deviceId: 'device-new' });

    const { result } = renderHook(() => useDeviceTrust(), { wrapper: authWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.trust();
    });

    expect(ok).toBe(true);
    expect(trustDevice).toHaveBeenCalledWith('user-1', undefined);
    expect(getFullDeviceInfo).toHaveBeenCalled();
    await waitFor(() => expect(result.current.isTrusted).toBe(true));
    expect(result.current.currentDeviceName).toBe('Test Device');
  });

  it('surfaces an error when trusting fails', async () => {
    vi.mocked(trustDevice).mockResolvedValue({ success: false, error: 'nope' });

    const { result } = renderHook(() => useDeviceTrust(), { wrapper: authWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.trust();
    });

    expect(ok).toBe(false);
    await waitFor(() => expect(result.current.error).toBe('nope'));
  });

  it('revokes trust for the current device', async () => {
    vi.mocked(isDeviceTrusted).mockResolvedValue({
      trusted: true,
      deviceId: 'device-9',
      deviceName: 'My Laptop',
    });
    vi.mocked(getCurrentDeviceId).mockResolvedValue('device-9');
    vi.mocked(revokeDeviceTrust).mockResolvedValue({ success: true });

    const { result } = renderHook(() => useDeviceTrust(), { wrapper: authWrapper() });
    await waitFor(() => expect(result.current.isTrusted).toBe(true));

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.revokeCurrentDevice();
    });

    expect(ok).toBe(true);
    expect(revokeDeviceTrust).toHaveBeenCalledWith('device-9', 'user-1');
    await waitFor(() => expect(result.current.isTrusted).toBe(false));
  });
});
