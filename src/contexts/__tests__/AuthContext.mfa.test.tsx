import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { createSupabaseMock } from '@/test/mocks/supabase';

/**
 * The MFA rules in AuthProvider:
 *
 * - Cached admin state is restored only for an aal2 session. An aal1 session
 *   with a cache entry still goes to admin-auth, which answers mfa_required.
 * - An mfa_required answer, as a response body or as the Error
 *   invokeEdgeFunction returns for a 403, sets mfaRequired so the login and
 *   callback screens show the MFA step instead of "access denied".
 * - A successful verification ends in admin_verified.
 *
 * The Supabase client, the edge-function caller and the encrypted cache are
 * mocked; the session reaches the provider through auth.getSession(), which
 * is the immediate check it runs on mount.
 */

const mocks = vi.hoisted(() => ({
  supabase: null as unknown as ReturnType<typeof createSupabaseMock>,
  invokeEdgeFunction: vi.fn(),
  secureGet: vi.fn(),
  secureSet: vi.fn(() => Promise.resolve(true)),
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

vi.mock('@/lib/edge-functions', () => ({
  invokeEdgeFunction: mocks.invokeEdgeFunction,
}));

vi.mock('@/lib/secure-cache', () => ({
  secureGet: mocks.secureGet,
  secureSet: mocks.secureSet,
  secureRemove: vi.fn(),
  clearCacheSalt: vi.fn(),
  isSecureCacheAvailable: () => true,
}));

vi.mock('@/lib/session-rotation', () => ({
  initializeSessionRotation: vi.fn(),
  clearRotationState: vi.fn(),
  startPeriodicRotation: vi.fn(),
  stopPeriodicRotation: vi.fn(),
  rotateAfterSensitiveOperation: vi.fn(),
}));

vi.mock('@/components/ui/sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));

import { AuthProvider, useAuth } from '@/contexts/AuthContext';

const USER_ID = '11111111-2222-3333-4444-555555555555';
const ADMIN = {
  id: USER_ID,
  email: 'admin@example.com',
  username: 'admin',
  roles: ['admin'],
  permissions: ['articles.read'],
};

const b64url = (value: object) =>
  btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const token = (aal: 'aal1' | 'aal2') =>
  `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub: USER_ID, aal })}.signature`;

function sessionWith(aal: 'aal1' | 'aal2') {
  return {
    access_token: token(aal),
    refresh_token: 'refresh',
    token_type: 'bearer',
    expires_in: 3600,
    user: { id: USER_ID, email: ADMIN.email },
  };
}

/** A fresh cache entry, as setCachedAdminData would have written it. */
const freshCache = () => ({ adminUser: ADMIN, userId: USER_ID, timestamp: Date.now() });

function givenSession(aal: 'aal1' | 'aal2') {
  mocks.supabase.auth.getSession.mockResolvedValue({
    data: { session: sessionWith(aal) },
    error: null,
  } as never);
}

let verify: () => Promise<boolean>;

function Probe() {
  const auth = useAuth();
  verify = auth.verifyAdminAccess;
  return (
    <dl>
      <dt>status</dt>
      <dd data-testid="status">{auth.authStatus}</dd>
      <dt>mfa</dt>
      <dd data-testid="mfa">{String(auth.mfaRequired)}</dd>
      <dt>verified</dt>
      <dd data-testid="verified">{String(auth.isAdminVerified)}</dd>
      <dt>email</dt>
      <dd data-testid="email">{auth.adminUser?.email ?? ''}</dd>
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

const adminAuthCalls = () =>
  mocks.invokeEdgeFunction.mock.calls.filter(([name]) => name === 'admin-auth');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.secureGet.mockResolvedValue(null);
  mocks.invokeEdgeFunction.mockResolvedValue({ data: ADMIN, error: null });
});

describe('AuthProvider MFA handling', () => {
  it('ignores the admin cache for an aal1 session and asks admin-auth instead', async () => {
    givenSession('aal1');
    mocks.secureGet.mockResolvedValue(freshCache());
    mocks.invokeEdgeFunction.mockResolvedValue({ data: { error: 'mfa_required' }, error: null });

    renderProvider();
    await statusSettlesOn('authenticated');

    expect(screen.getByTestId('verified')).toHaveTextContent('false');
    expect(screen.getByTestId('email')).toHaveTextContent('');
    expect(adminAuthCalls()).toEqual([['admin-auth', { body: { action: 'me' } }]]);
    // The cached entry was never read back as admin state.
    expect(mocks.secureGet).not.toHaveBeenCalled();
  });

  it('sets mfaRequired when admin-auth answers mfa_required in the body', async () => {
    givenSession('aal1');
    mocks.invokeEdgeFunction.mockResolvedValue({ data: { error: 'mfa_required' }, error: null });

    renderProvider();
    await statusSettlesOn('authenticated');
    expect(screen.getByTestId('mfa')).toHaveTextContent('true');
  });

  it('sets mfaRequired when invokeEdgeFunction returns the mfa_required Error', async () => {
    givenSession('aal1');
    mocks.invokeEdgeFunction.mockResolvedValue({ data: null, error: new Error('mfa_required') });

    renderProvider();
    await statusSettlesOn('authenticated');
    expect(screen.getByTestId('mfa')).toHaveTextContent('true');
  });

  it('does not set mfaRequired for any other refusal', async () => {
    givenSession('aal2');
    mocks.invokeEdgeFunction.mockResolvedValue({ data: { error: 'Access denied' }, error: null });

    renderProvider();
    await statusSettlesOn('authenticated');
    expect(screen.getByTestId('mfa')).toHaveTextContent('false');
    expect(screen.getByTestId('verified')).toHaveTextContent('false');
  });

  it('restores an aal2 session from a fresh cache without calling admin-auth', async () => {
    givenSession('aal2');
    mocks.secureGet.mockResolvedValue(freshCache());

    renderProvider();
    await statusSettlesOn('admin_verified');

    expect(screen.getByTestId('verified')).toHaveTextContent('true');
    expect(screen.getByTestId('email')).toHaveTextContent(ADMIN.email);
    expect(adminAuthCalls()).toHaveLength(0);
  });

  it('verifies an aal2 session with no cache through admin-auth and caches the result', async () => {
    givenSession('aal2');

    renderProvider();
    await statusSettlesOn('admin_verified');

    expect(adminAuthCalls()).toHaveLength(1);
    expect(screen.getByTestId('mfa')).toHaveTextContent('false');
    expect(mocks.secureSet).toHaveBeenCalledWith(
      'admin_user_cache',
      expect.objectContaining({ userId: USER_ID, adminUser: expect.objectContaining(ADMIN) }),
      USER_ID
    );
  });

  it('verifyAdminAccess sets mfaRequired, then clears it once MFA is done', async () => {
    givenSession('aal1');
    mocks.invokeEdgeFunction.mockResolvedValue({ data: { error: 'mfa_required' }, error: null });
    renderProvider();
    await statusSettlesOn('authenticated');

    // The user completes the MFA challenge; the session is now aal2 and the
    // server accepts it.
    givenSession('aal2');
    mocks.invokeEdgeFunction.mockResolvedValue({ data: ADMIN, error: null });
    let ok = false;
    await act(async () => {
      ok = await verify();
    });

    expect(ok).toBe(true);
    await statusSettlesOn('admin_verified');
    expect(screen.getByTestId('mfa')).toHaveTextContent('false');
    expect(screen.getByTestId('verified')).toHaveTextContent('true');
  });

  it('verifyAdminAccess reports mfa_required from the server', async () => {
    givenSession('aal2');
    renderProvider();
    await statusSettlesOn('admin_verified');

    mocks.invokeEdgeFunction.mockResolvedValue({ data: null, error: new Error('mfa_required') });
    let ok = true;
    await act(async () => {
      ok = await verify();
    });

    expect(ok).toBe(false);
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    expect(screen.getByTestId('mfa')).toHaveTextContent('true');
    expect(screen.getByTestId('verified')).toHaveTextContent('false');
  });
});
