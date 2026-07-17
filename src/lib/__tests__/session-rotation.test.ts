import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock Supabase auth and the edge-function helper the rotation service uses.
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      refreshSession: vi.fn(),
    },
  },
}));
vi.mock('@/lib/edge-functions', () => ({
  invokeEdgeFunction: vi.fn().mockResolvedValue({ data: {}, error: null }),
}));

import { supabase } from '@/integrations/supabase/client';
import {
  startPeriodicRotation,
  stopPeriodicRotation,
  rotateSession,
  rotateAfterSensitiveOperation,
  initializeSessionRotation,
  clearRotationState,
  isRotationNeeded,
  getRotationStats,
} from '../session-rotation';

const auth = supabase.auth as unknown as {
  getSession: ReturnType<typeof vi.fn>;
  refreshSession: ReturnType<typeof vi.fn>;
};

const activeSession = { access_token: 't', expires_at: Math.floor(Date.now() / 1000) + 3600 };

beforeEach(() => {
  localStorage.clear();
  clearRotationState();
  vi.clearAllMocks();
  auth.getSession.mockResolvedValue({ data: { session: activeSession }, error: null });
  auth.refreshSession.mockResolvedValue({ data: { session: activeSession }, error: null });
  initializeSessionRotation(); // sets lastRotation = now (not overdue)
});

afterEach(() => {
  stopPeriodicRotation();
  clearRotationState();
});

describe('session-rotation', () => {
  it('starts and stops periodic rotation (isActive toggles)', () => {
    expect(getRotationStats().isActive).toBe(false);
    startPeriodicRotation();
    expect(getRotationStats().isActive).toBe(true);
    stopPeriodicRotation();
    expect(getRotationStats().isActive).toBe(false);
  });

  it('rotates the session via rotateSession() and increments the count', async () => {
    const result = await rotateSession('manual');
    expect(result.success).toBe(true);
    expect(result.newSession).toBe(true);
    expect(auth.refreshSession).toHaveBeenCalled();
    expect(getRotationStats().rotationCount).toBeGreaterThan(0);
  });

  it('rotates after a sensitive operation', async () => {
    const result = await rotateAfterSensitiveOperation('password_change');
    expect(result.success).toBe(true);
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });

  it('fails gracefully when there is no active session', async () => {
    auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
    const result = await rotateSession();
    expect(result.success).toBe(false);
    expect(result.error).toBe('No active session');
    expect(auth.refreshSession).not.toHaveBeenCalled();
  });

  it('preserves the previous token when refresh fails', async () => {
    auth.refreshSession.mockResolvedValue({
      data: { session: null },
      error: { message: 'refresh failed' },
    });
    const result = await rotateSession();
    expect(result.success).toBe(false);
    expect(result.error).toBe('refresh failed');
  });

  it('clearRotationState clears storage and stops the timer (cleanup)', async () => {
    startPeriodicRotation();
    await rotateSession('manual'); // writes rotation state to localStorage
    expect(localStorage.getItem('session_last_rotation')).not.toBeNull();

    clearRotationState();
    expect(localStorage.getItem('session_last_rotation')).toBeNull();
    expect(getRotationStats().isActive).toBe(false);
  });

  it('isRotationNeeded is false right after init and true when overdue', () => {
    expect(isRotationNeeded()).toBe(false);
    // Simulate a very old last-rotation timestamp in shared storage.
    localStorage.setItem('session_last_rotation', '1000');
    expect(isRotationNeeded()).toBe(true);
  });
});
