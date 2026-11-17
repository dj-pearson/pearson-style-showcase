import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { createSupabaseMock } from '@/test/mocks/supabase';

/**
 * AuthProvider's sign-in, sign-out, background re-verification and
 * permission checks. MFA routing is in AuthContext.mfa.test.tsx; the mocks
 * here are the same.
 */

const mocks = vi.hoisted(() => ({
  supabase: null as unknown as ReturnType<typeof createSupabaseMock>,
  invokeEdgeFunction: vi.fn(),
  secureGet: vi.fn(),
  secureSet: vi.fn(() => Promise.resolve(true)),
  secureRemove: vi.fn(),
  rotateAfterSensitiveOperation: vi.fn(() => Promise.resolve({ success: true })),
  toastError: vi.fn(),
}));

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  mocks.supabase = createSupabaseMock();
  return {
    supabase: mocks.supabase,
    isApiReachable: () => true,
    clearStaleAuthTokens: vi.fn(),
  };
});

vi.mock('@/lib/edge-functions', () => ({ invokeEdgeFunction: mocks.invokeEdgeFunction }));

vi.mock('@/lib/secure-cache', () => ({
  secureGet: mocks.secureGet,
  secureSet: mocks.secureSet,
  secureRemove: mocks.secureRemove,
  clearCacheSalt: vi.fn(),
  isSecureCacheAvailable: () => true,
}));

vi.mock('@/lib/session-rotation', () => ({
  initializeSessionRotation: vi.fn(),
  clearRotationState: vi.fn(),
  startPeriodicRotation: vi.fn(),
  stopPeriodicRotation: vi.fn(),
  rotateAfterSensitiveOperation: mocks.rotateAfterSensitiveOperation,
}));

vi.mock('@/components/ui/sonner', () => ({
  toast: Object.assign(vi.fn(), { error: mocks.toastError }),
}));

import { AuthProvider, useAuth } from '@/contexts/AuthContext';

const USER_ID = '11111111-2222-3333-4444-555555555555';
const ADMIN = {
  id: USER_ID,
  email: 'admin@example.com',
  username: 'admin',
  roles: ['editor'],
  permissions: ['articles.read', 'articles.write'],
};

const b64url = (value: object) =>
  btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const SESSION = {
  access_token: `${b64url({ alg: 'HS256' })}.${b64url({ sub: USER_ID, aal: 'aal2' })}.sig`,
  refresh_token: 'refresh',
  token_type: 'bearer',
  expires_in: 3600,
  user: { id: USER_ID, email: ADMIN.email },
};

let auth: ReturnType<typeof useAuth>;

function Probe() {
  auth = useAuth();
  return (
    <dl>
      <dt>status</dt>
      <dd data-testid="status">{auth.authStatus}</dd>
      <dt>error</dt>
      <dd data-testid="error">{auth.error ?? ''}</dd>
      <dt>warning</dt>
      <dd data-testid="warning">{auth.securityWarning ?? ''}</dd>
    </dl>
  );
}

const renderProvider = () =>
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );

const statusSettlesOn = (status: string) =>
  waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent(status));

function givenSession(session: typeof SESSION | null) {
  mocks.supabase.auth.getSession.mockResolvedValue({ data: { session }, error: null } as never);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.secureGet.mockResolvedValue(null);
  mocks.invokeEdgeFunction.mockResolvedValue({ data: ADMIN, error: null });
  givenSession(null);
});

describe('signIn', () => {
  it('verifies admin access and rotates the session on success', async () => {
    renderProvider();
    await statusSettlesOn('unauthenticated');

    mocks.supabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: SESSION, user: SESSION.user },
      error: null,
    } as never);
    givenSession(SESSION);

    let result: { success: boolean; error?: string } = { success: false };
    await act(async () => {
      result = await auth.signIn(ADMIN.email, 'pw');
    });

    expect(result).toEqual({ success: true });
    await statusSettlesOn('admin_verified');
    expect(mocks.rotateAfterSensitiveOperation).toHaveBeenCalledWith('login');
  });

  it('gives the same generic error for a wrong password and for a non-admin', async () => {
    renderProvider();
    await statusSettlesOn('unauthenticated');

    mocks.supabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    } as never);
    let wrongPassword: { success: boolean; error?: string } = { success: true };
    await act(async () => {
      wrongPassword = await auth.signIn(ADMIN.email, 'bad');
    });

    mocks.supabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: SESSION, user: SESSION.user },
      error: null,
    } as never);
    givenSession(SESSION);
    mocks.invokeEdgeFunction.mockResolvedValue({ data: { error: 'Access denied' }, error: null });
    let notAdmin: { success: boolean; error?: string } = { success: true };
    await act(async () => {
      notAdmin = await auth.signIn(ADMIN.email, 'pw');
    });

    expect(wrongPassword).toEqual({ success: false, error: 'Authentication failed' });
    expect(notAdmin).toEqual(wrongPassword);
    // The non-admin's Supabase session is not left behind.
    expect(mocks.supabase.auth.signOut).toHaveBeenCalled();
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
    expect(screen.getByTestId('error')).toHaveTextContent('Authentication failed');
  });
});

describe('signOut', () => {
  it('invalidates the server session, then the Supabase one, with no warning', async () => {
    givenSession(SESSION);
    renderProvider();
    await statusSettlesOn('admin_verified');

    mocks.invokeEdgeFunction.mockResolvedValue({ data: { success: true }, error: null });
    await act(async () => {
      await auth.signOut();
    });

    expect(mocks.invokeEdgeFunction).toHaveBeenCalledWith('admin-auth', {
      body: { action: 'logout' },
    });
    expect(mocks.supabase.auth.signOut).toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
    expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated');
  });
});

describe('background re-verification of a cached session', () => {
  it('revokes admin state and warns when the server no longer confirms it', async () => {
    givenSession(SESSION);
    // Six minutes old: inside the 10 minute TTL, past the 5 minute refresh.
    mocks.secureGet.mockResolvedValue({
      adminUser: ADMIN,
      userId: USER_ID,
      timestamp: Date.now() - 6 * 60 * 1000,
    });
    mocks.invokeEdgeFunction.mockResolvedValue({ data: { error: 'Access denied' }, error: null });

    renderProvider();

    await statusSettlesOn('unauthenticated');
    expect(screen.getByTestId('warning')).toHaveTextContent(/could not be re-verified/);
    expect(mocks.secureRemove).toHaveBeenCalledWith('admin_user_cache');
  });

  it('keeps a fresh cache without asking the server', async () => {
    givenSession(SESSION);
    mocks.secureGet.mockResolvedValue({ adminUser: ADMIN, userId: USER_ID, timestamp: Date.now() });

    renderProvider();
    await statusSettlesOn('admin_verified');
    expect(mocks.invokeEdgeFunction).not.toHaveBeenCalled();
  });
});

describe('requireFreshAdminVerification', () => {
  it('raises a security warning when the server refuses, and it can be dismissed', async () => {
    givenSession(SESSION);
    renderProvider();
    await statusSettlesOn('admin_verified');

    mocks.invokeEdgeFunction.mockResolvedValue({ data: { error: 'Access denied' }, error: null });
    let ok = true;
    await act(async () => {
      ok = await auth.requireFreshAdminVerification();
    });
    expect(ok).toBe(false);
    expect(screen.getByTestId('warning')).toHaveTextContent(/could not be re-verified/);

    act(() => auth.dismissSecurityWarning());
    expect(screen.getByTestId('warning')).toHaveTextContent('');
  });
});

describe('role and permission checks', () => {
  it('answer from the verified admin user', async () => {
    givenSession(SESSION);
    renderProvider();
    await statusSettlesOn('admin_verified');

    expect(auth.hasRole('editor')).toBe(true);
    expect(auth.hasRole('admin')).toBe(false);
    expect(auth.isEditor).toBe(true);
    expect(auth.isAdmin).toBe(false);
    expect(auth.hasPermission('articles.write')).toBe(true);
    expect(auth.hasPermission('vault.read')).toBe(false);
    expect(auth.hasAnyPermission(['vault.read', 'articles.read'])).toBe(true);
    expect(auth.hasAllPermissions(['articles.read', 'articles.write'])).toBe(true);
    expect(auth.hasAllPermissions(['articles.read', 'vault.read'])).toBe(false);
  });

  it('a missing roles field grants no role', async () => {
    givenSession(SESSION);
    mocks.invokeEdgeFunction.mockResolvedValue({
      data: { id: USER_ID, email: ADMIN.email },
      error: null,
    });
    renderProvider();
    await statusSettlesOn('admin_verified');

    expect(auth.roles).toEqual([]);
    expect(auth.isAdmin).toBe(false);
    expect(auth.hasAnyPermission(['articles.read'])).toBe(false);
  });
});
