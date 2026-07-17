import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthContext } from '@/contexts/AuthContext';
import { createMockAuthValue } from '@/test/test-utils';
import type { AppRole } from '@/contexts/AuthContext';
import {
  usePermission,
  useAnyPermission,
  useAllPermissions,
  useRole,
  usePermissions,
  useRoles,
} from '../usePermission';

/**
 * Build an AuthContext value whose permission/role predicates actually reflect
 * the supplied arrays (createMockAuthValue's defaults always return false).
 */
function buildAuth(
  permissions: string[],
  roles: AppRole[] = [],
  extra: Record<string, unknown> = {}
) {
  return createMockAuthValue({
    permissions,
    roles,
    isAuthenticated: true,
    hasPermission: (p: string) => permissions.includes(p),
    hasAnyPermission: (ps: string[]) => ps.some((p) => permissions.includes(p)),
    hasAllPermissions: (ps: string[]) => ps.every((p) => permissions.includes(p)),
    hasRole: (r: AppRole) => roles.includes(r),
    ...extra,
  });
}

function wrapperFor(value: ReturnType<typeof buildAuth>) {
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  );
}

describe('usePermission', () => {
  it('returns true when the permission is granted (happy path)', () => {
    const { result } = renderHook(() => usePermission('articles.create'), {
      wrapper: wrapperFor(buildAuth(['articles.create'])),
    });
    expect(result.current).toBe(true);
  });

  it('returns false when the permission is denied', () => {
    const { result } = renderHook(() => usePermission('articles.delete'), {
      wrapper: wrapperFor(buildAuth(['articles.create'])),
    });
    expect(result.current).toBe(false);
  });

  it('returns false during the loading/initializing state (no permissions yet)', () => {
    const { result } = renderHook(() => usePermission('articles.read'), {
      wrapper: wrapperFor(buildAuth([], [], { isLoading: true, authStatus: 'initializing' })),
    });
    expect(result.current).toBe(false);
  });

  it('throws a clear error when used outside an AuthProvider (error handling)', () => {
    // Suppress the expected React error boundary console noise.
    expect(() => renderHook(() => usePermission('x'))).toThrow(
      /useAuth must be used within an AuthProvider/
    );
  });

  it('reflects updated permissions after the auth value changes (cache invalidation)', () => {
    // Before the grant is applied to the context.
    const before = renderHook(() => usePermission('users.update'), {
      wrapper: wrapperFor(buildAuth([])),
    });
    expect(before.result.current).toBe(false);

    // After the auth context is refreshed with the newly granted permission.
    const after = renderHook(() => usePermission('users.update'), {
      wrapper: wrapperFor(buildAuth(['users.update'])),
    });
    expect(after.result.current).toBe(true);
  });

  it('useAnyPermission is true when at least one permission matches', () => {
    const { result } = renderHook(() => useAnyPermission(['a.read', 'a.write']), {
      wrapper: wrapperFor(buildAuth(['a.write'])),
    });
    expect(result.current).toBe(true);
  });

  it('useAllPermissions is false when one required permission is missing', () => {
    const { result } = renderHook(() => useAllPermissions(['a.read', 'a.write']), {
      wrapper: wrapperFor(buildAuth(['a.read'])),
    });
    expect(result.current).toBe(false);
  });

  it('useRole, usePermissions and useRoles read from the auth context', () => {
    const auth = buildAuth(['a.read'], ['admin']);
    const wrapper = wrapperFor(auth);
    expect(renderHook(() => useRole('admin'), { wrapper }).result.current).toBe(true);
    expect(renderHook(() => useRole('viewer'), { wrapper }).result.current).toBe(false);
    expect(renderHook(() => usePermissions(), { wrapper }).result.current).toEqual(['a.read']);
    expect(renderHook(() => useRoles(), { wrapper }).result.current).toEqual(['admin']);
  });
});
