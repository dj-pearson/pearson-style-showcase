import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { createMockAuthValue } from '@/test/test-utils';
import type { User } from '@supabase/supabase-js';

// Mock the Supabase client - only auth.mfa.listFactors is exercised here.
const listFactors = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: { mfa: { listFactors: (...args: unknown[]) => listFactors(...args) } },
  },
}));

import { useMFAStatus } from '../useMFAStatus';

const mockUser = { id: 'user-1', email: 'a@b.com' } as unknown as User;

function wrapper(adminVerified = true) {
  const value = createMockAuthValue({
    user: mockUser,
    isAuthenticated: true,
    isAdminVerified: adminVerified,
  });
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

function verifiedFactor() {
  return {
    data: {
      totp: [
        {
          id: 'factor-1',
          status: 'verified',
          friendly_name: 'Authenticator',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
    },
    error: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('useMFAStatus', () => {
  it('reports MFA enabled when a verified factor exists (happy path)', async () => {
    listFactors.mockResolvedValue(verifiedFactor());

    const { result } = renderHook(() => useMFAStatus(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isEnabled).toBe(true);
    expect(result.current.factors).toHaveLength(1);
    expect(result.current.requiresSetup).toBe(false);
    expect(result.current.gracePeriodRemaining).toBeNull();
  });

  it('reports MFA disabled and starts a grace period when no verified factor exists', async () => {
    listFactors.mockResolvedValue({ data: { totp: [] }, error: null });

    const { result } = renderHook(() => useMFAStatus({ gracePeriodDays: 7 }), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isEnabled).toBe(false);
    expect(result.current.gracePeriodRemaining).toBe(7);
    expect(result.current.requiresSetup).toBe(false); // still within grace
  });

  it('requires setup once the grace period has expired (edge case)', async () => {
    listFactors.mockResolvedValue({ data: { totp: [] }, error: null });
    // Seed an old reminder date so the grace period is already exhausted.
    localStorage.setItem('mfa_setup_reminder_date', '2000-01-01T00:00:00.000Z');

    const { result } = renderHook(() => useMFAStatus({ gracePeriodDays: 7 }), {
      wrapper: wrapper(),
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isEnabled).toBe(false);
    expect(result.current.gracePeriodRemaining).toBe(0);
    expect(result.current.requiresSetup).toBe(true);
  });

  it('surfaces an error when listing factors fails (error handling)', async () => {
    listFactors.mockResolvedValue({ data: null, error: { message: 'boom' } });

    const { result } = renderHook(() => useMFAStatus(), { wrapper: wrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('boom');
    expect(result.current.isEnabled).toBe(false);
  });

  it('does not auto-check until the admin is verified, then refreshes on demand', async () => {
    listFactors.mockResolvedValue(verifiedFactor());

    const { result } = renderHook(() => useMFAStatus(), { wrapper: wrapper(false) });

    // checkOnMount effect is gated on isAdminVerified, so no call yet.
    expect(listFactors).not.toHaveBeenCalled();

    await act(async () => {
      await result.current.checkMFAStatus();
    });

    expect(listFactors).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.isEnabled).toBe(true));
  });

  it('dismissReminder resets the grace period', async () => {
    listFactors.mockResolvedValue({ data: { totp: [] }, error: null });

    const { result } = renderHook(() => useMFAStatus({ gracePeriodDays: 5 }), {
      wrapper: wrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.dismissReminder();
    });

    expect(result.current.gracePeriodRemaining).toBe(5);
    expect(localStorage.getItem('mfa_setup_reminder_date')).not.toBeNull();
  });
});
