import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from '@/test/test-utils';
import { createSupabaseMock } from '@/test/mocks/supabase';

/**
 * AdminLogin sends a signed-in user down one of two MFA paths:
 *
 * - no TOTP factor yet          -> MFAEnrollment
 * - a TOTP factor, session aal1 -> MFAVerification with that factor's id
 *
 * Both after a password sign-in (handleLogin) and when the page mounts on an
 * already-authenticated aal1 session, as after an OAuth redirect
 * (checkMFAStatus). An aal2 session shows neither: it is waiting on admin
 * verification. The two MFA components are stubbed; their own flows are not
 * under test here.
 */

const mocks = vi.hoisted(() => ({
  supabase: null as unknown as ReturnType<typeof createSupabaseMock> & {
    auth: { mfa: Record<string, ReturnType<typeof vi.fn>> };
  },
}));

vi.mock('@/integrations/supabase/client', async () => {
  const { createSupabaseMock } = await import('@/test/mocks/supabase');
  const supabase = createSupabaseMock();
  Object.assign(supabase.auth, {
    mfa: {
      listFactors: vi.fn(),
      getAuthenticatorAssuranceLevel: vi.fn(),
    },
  });
  mocks.supabase = supabase as typeof mocks.supabase;
  return { supabase, isApiReachable: () => true };
});

vi.mock('@/components/auth/MFAEnrollment', () => ({
  MFAEnrollment: () => <p>MFA enrollment step</p>,
}));

vi.mock('@/components/auth/MFAVerification', () => ({
  MFAVerification: ({ factorId }: { factorId: string }) => (
    <p>MFA verification step for {factorId}</p>
  ),
}));

vi.mock('@/components/SEO', () => ({ default: () => null }));

import AdminLogin from '../AdminLogin';

const SESSION = { access_token: 'x.y.z', user: { id: 'user-1' } };
const FACTOR = { id: 'totp-factor-1', factor_type: 'totp', status: 'verified' };

function givenFactors(totp: unknown[]) {
  mocks.supabase.auth.mfa.listFactors.mockResolvedValue({
    data: { all: totp, totp },
    error: null,
  });
}

function givenAal(currentLevel: 'aal1' | 'aal2', nextLevel: 'aal1' | 'aal2') {
  mocks.supabase.auth.mfa.getAuthenticatorAssuranceLevel.mockResolvedValue({
    data: { currentLevel, nextLevel },
    error: null,
  });
}

async function signInWithPassword() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('Email'), 'admin@example.com');
  await user.type(screen.getByLabelText('Password'), 'correct horse battery staple');
  await user.click(screen.getByRole('button', { name: /sign in/i }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.supabase.auth.signInWithPassword.mockResolvedValue({
    data: { session: SESSION, user: SESSION.user },
    error: null,
  } as never);
  mocks.supabase.auth.getSession.mockResolvedValue({
    data: { session: SESSION },
    error: null,
  } as never);
});

describe('AdminLogin MFA routing after a password sign-in', () => {
  it('shows enrollment when the account has no TOTP factor', async () => {
    givenFactors([]);
    render(<AdminLogin />, { authValue: { authStatus: 'unauthenticated' } });

    await signInWithPassword();

    expect(await screen.findByText('MFA enrollment step')).toBeInTheDocument();
    expect(screen.queryByText(/MFA verification step/)).not.toBeInTheDocument();
  });

  it('shows verification for the enrolled factor when there is one', async () => {
    givenFactors([FACTOR]);
    render(<AdminLogin />, { authValue: { authStatus: 'unauthenticated' } });

    await signInWithPassword();

    expect(await screen.findByText(`MFA verification step for ${FACTOR.id}`)).toBeInTheDocument();
    expect(screen.queryByText('MFA enrollment step')).not.toBeInTheDocument();
  });

  it('stays on the form and shows the error when the password is wrong', async () => {
    mocks.supabase.auth.signInWithPassword.mockResolvedValue({
      data: { session: null, user: null },
      error: { message: 'Invalid login credentials' },
    } as never);
    render(<AdminLogin />, { authValue: { authStatus: 'unauthenticated' } });

    await signInWithPassword();

    expect(await screen.findByText('Invalid login credentials')).toBeInTheDocument();
    expect(mocks.supabase.auth.mfa.listFactors).not.toHaveBeenCalled();
  });
});

describe('AdminLogin MFA routing for an existing aal1 session', () => {
  it('shows enrollment when no factor is enrolled', async () => {
    givenAal('aal1', 'aal1');
    givenFactors([]);
    render(<AdminLogin />, { authValue: { authStatus: 'authenticated' } });

    expect(await screen.findByText('MFA enrollment step')).toBeInTheDocument();
  });

  it('shows verification when a factor is enrolled and aal2 is next', async () => {
    givenAal('aal1', 'aal2');
    givenFactors([FACTOR]);
    render(<AdminLogin />, { authValue: { authStatus: 'authenticated' } });

    expect(await screen.findByText(`MFA verification step for ${FACTOR.id}`)).toBeInTheDocument();
  });

  it('shows neither for a session that already passed MFA', async () => {
    givenAal('aal2', 'aal2');
    givenFactors([FACTOR]);
    render(<AdminLogin />, { authValue: { authStatus: 'authenticated' } });

    await waitFor(() =>
      expect(mocks.supabase.auth.mfa.getAuthenticatorAssuranceLevel).toHaveBeenCalled()
    );
    expect(mocks.supabase.auth.mfa.listFactors).not.toHaveBeenCalled();
    expect(screen.queryByText('MFA enrollment step')).not.toBeInTheDocument();
    expect(screen.queryByText(/MFA verification step/)).not.toBeInTheDocument();
  });
});
