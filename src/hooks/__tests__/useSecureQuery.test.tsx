import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthContext } from '@/contexts/AuthContext';
import { createMockAuthValue, createTestQueryClient } from '@/test/test-utils';

// Security layer + ownership dependencies are mocked so we test the hook's own
// gating/authorization wiring, not their internals.
vi.mock('@/lib/security-layers', () => ({
  runSecurityCheck: vi.fn(),
  logSecurityEvent: vi.fn().mockResolvedValue(undefined),
}));

const ownershipState = {
  getOwnershipFilter: vi.fn(() => null as { field: string; value: string } | null),
  hasAdminBypass: false,
  hasRoleBypass: false,
  userId: 'user-1',
  ownerField: 'user_id',
  withOwnership: vi.fn(),
};
vi.mock('../useResourceOwnership', () => ({
  useResourceOwnership: () => ownershipState,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { from: vi.fn() },
}));

import { runSecurityCheck, logSecurityEvent } from '@/lib/security-layers';
import { useSecureQuery } from '../useSecureQuery';

function wrapper(authOverrides: Record<string, unknown> = {}) {
  const client = createTestQueryClient();
  const value = createMockAuthValue({
    isAuthenticated: true,
    isAdminVerified: true,
    adminUser: {
      id: 'admin-1',
      email: 'admin@x.com',
      roles: ['admin'],
      permissions: [],
    },
    ...authOverrides,
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  ownershipState.hasAdminBypass = false;
  ownershipState.hasRoleBypass = false;
  ownershipState.getOwnershipFilter.mockReturnValue(null);
});

describe('useSecureQuery', () => {
  it('runs the query and returns data when authorized (happy path)', async () => {
    vi.mocked(runSecurityCheck).mockResolvedValue({ authorized: true } as never);
    const queryFn = vi.fn().mockResolvedValue(['a', 'b']);

    const { result } = renderHook(
      () => useSecureQuery({ queryKey: ['items'], resourceType: 'article', queryFn }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.data).toEqual(['a', 'b']));
    expect(runSecurityCheck).toHaveBeenCalledWith('article', 'list');
    expect(queryFn).toHaveBeenCalled();
    expect(result.current.isError).toBe(false);
  });

  it('keeps the query disabled and in loading state when security is not ready (unauthenticated)', async () => {
    vi.mocked(runSecurityCheck).mockResolvedValue({ authorized: true } as never);
    const queryFn = vi.fn().mockResolvedValue(['x']);

    const { result } = renderHook(
      () => useSecureQuery({ queryKey: ['items'], resourceType: 'article', queryFn }),
      { wrapper: wrapper({ isAuthenticated: false, isAdminVerified: false }) }
    );

    // Give any effects a tick; the query must never fire.
    await new Promise((r) => setTimeout(r, 0));
    expect(queryFn).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.securityStatus.isChecking).toBe(true);
    expect(result.current.securityStatus.isAuthorized).toBe(false);
  });

  it('surfaces an error when the security check denies access', async () => {
    vi.mocked(runSecurityCheck).mockResolvedValue({
      authorized: false,
      error: 'Access denied',
    } as never);
    const queryFn = vi.fn().mockResolvedValue(['secret']);

    const { result } = renderHook(
      () => useSecureQuery({ queryKey: ['items'], resourceType: 'article', queryFn }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Access denied');
    expect(queryFn).not.toHaveBeenCalled();
    expect(logSecurityEvent).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'access_denied' })
    );
  });

  it('passes the ownership filter to the query function when no bypass applies', async () => {
    vi.mocked(runSecurityCheck).mockResolvedValue({ authorized: true } as never);
    ownershipState.getOwnershipFilter.mockReturnValue({ field: 'user_id', value: 'user-1' });
    const queryFn = vi.fn().mockResolvedValue([]);

    const { result } = renderHook(
      () => useSecureQuery({ queryKey: ['items'], resourceType: 'article', queryFn }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(queryFn).toHaveBeenCalled());
    expect(queryFn).toHaveBeenCalledWith({ field: 'user_id', value: 'user-1' });
    expect(result.current.securityStatus.ownershipFilter).toEqual({
      field: 'user_id',
      value: 'user-1',
    });
  });

  it('applies no ownership filter for admins with bypass', async () => {
    vi.mocked(runSecurityCheck).mockResolvedValue({ authorized: true } as never);
    ownershipState.hasAdminBypass = true;
    ownershipState.getOwnershipFilter.mockReturnValue({ field: 'user_id', value: 'user-1' });
    const queryFn = vi.fn().mockResolvedValue([]);

    const { result } = renderHook(
      () => useSecureQuery({ queryKey: ['items'], resourceType: 'article', queryFn }),
      { wrapper: wrapper() }
    );

    await waitFor(() => expect(queryFn).toHaveBeenCalled());
    expect(queryFn).toHaveBeenCalledWith(null);
    expect(result.current.securityStatus.ownershipFilter).toBeNull();
  });

  it('logs an access_granted event on an authorized query', async () => {
    vi.mocked(runSecurityCheck).mockResolvedValue({ authorized: true } as never);
    const queryFn = vi.fn().mockResolvedValue([1]);

    renderHook(
      () => useSecureQuery({ queryKey: ['items'], resourceType: 'article', queryFn }),
      { wrapper: wrapper() }
    );

    await waitFor(() =>
      expect(logSecurityEvent).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'access_granted' })
      )
    );
  });
});
