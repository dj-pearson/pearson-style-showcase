import { describe, it, expect, vi, beforeEach } from 'vitest';

const { getSession, insert, from } = vi.hoisted(() => {
  const insert = vi.fn();
  return {
    getSession: vi.fn(),
    insert,
    from: vi.fn(() => ({ insert })),
  };
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getSession }, from },
}));

import { buildSecurityEventRow, logSecurityEvent, type SecurityEvent } from '@/lib/security-layers';

const ADMIN_ID = '11111111-1111-4111-8111-111111111111';
const RESOURCE_ID = '22222222-2222-4222-8222-222222222222';

function makeEvent(overrides: Partial<SecurityEvent> = {}): SecurityEvent {
  return {
    type: 'access_denied',
    resourceType: 'invoice',
    action: 'read',
    userId: ADMIN_ID,
    result: {
      authorized: false,
      failedAt: 'ownership',
      layers: [
        { layer: 'authentication', passed: true },
        { layer: 'ownership', passed: false, error: 'not owner', details: { x: 1 } },
      ],
    },
    timestamp: new Date('2026-11-01T12:00:00Z'),
    ...overrides,
  };
}

describe('buildSecurityEventRow', () => {
  const actor = { id: ADMIN_ID, email: 'admin@example.com' };

  it('matches the admin_activity_log columns', () => {
    const row = buildSecurityEventRow(makeEvent({ resourceId: RESOURCE_ID }), actor);
    expect(row).not.toHaveProperty('details');
    expect(row).toMatchObject({
      admin_id: ADMIN_ID,
      admin_email: 'admin@example.com',
      action: 'security_access_denied',
      action_category: 'security',
      resource_type: 'invoice',
      resource_id: RESOURCE_ID,
      success: false,
      timestamp: '2026-11-01T12:00:00.000Z',
    });
    expect(row.metadata).toEqual({
      access_action: 'read',
      result: 'denied',
      failed_at: 'ownership',
      layers: [
        { layer: 'authentication', passed: true, error: undefined },
        { layer: 'ownership', passed: false, error: 'not owner' },
      ],
    });
  });

  it('moves a non-uuid resource id and a foreign user id into metadata', () => {
    const row = buildSecurityEventRow(
      makeEvent({ resourceId: 'INV-0042', userId: 'someone-else', metadata: { note: 'x' } }),
      actor
    );
    expect(row.admin_id).toBe(ADMIN_ID);
    expect(row.resource_id).toBeNull();
    expect(row.resource_type).toBe('invoice');
    expect(row.metadata).toMatchObject({
      note: 'x',
      resource_ref: 'INV-0042',
      subject_user_id: 'someone-else',
    });
  });

  it('does not let caller metadata overwrite the recorded result', () => {
    const row = buildSecurityEventRow(makeEvent({ metadata: { result: 'authorized' } }), actor);
    expect(row.metadata.result).toBe('denied');
  });

  it('defaults resource_type to system', () => {
    const row = buildSecurityEventRow(makeEvent({ resourceType: undefined }), actor);
    expect(row.resource_type).toBe('system');
  });
});

describe('logSecurityEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    insert.mockResolvedValue({ error: null });
  });

  it('inserts as the session user', async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { id: ADMIN_ID, email: 'admin@example.com' } } },
    });

    await logSecurityEvent(makeEvent());

    expect(from).toHaveBeenCalledWith('admin_activity_log');
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert.mock.calls[0][0]).toMatchObject({
      admin_id: ADMIN_ID,
      admin_email: 'admin@example.com',
    });
  });

  it('skips the insert when nobody is signed in', async () => {
    getSession.mockResolvedValue({ data: { session: null } });

    await logSecurityEvent(makeEvent());

    expect(from).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it('does not throw when the insert fails', async () => {
    getSession.mockResolvedValue({
      data: { session: { user: { id: ADMIN_ID, email: 'admin@example.com' } } },
    });
    insert.mockResolvedValue({ error: { message: 'rls' } });

    await expect(logSecurityEvent(makeEvent())).resolves.toBeUndefined();
  });
});
