/**
 * Session Token Rotation Service
 *
 * Provides session token rotation for enhanced security:
 * - Rotates tokens after sensitive operations (password change, permission change)
 * - Periodic rotation based on configurable interval
 * - Maintains session continuity during rotation
 */

import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edge-functions';
import { logger } from '@/lib/logger';

// Configuration
const SESSION_ROTATION_INTERVAL = 30 * 60 * 1000; // 30 minutes
const SENSITIVE_OPERATIONS = [
  'password_change',
  'email_change',
  'role_change',
  'permission_change',
  'mfa_enable',
  'mfa_disable',
  'login',
  'oauth_callback',
] as const;

type SensitiveOperation = typeof SENSITIVE_OPERATIONS[number];

// Storage keys
const LAST_ROTATION_KEY = 'session_last_rotation';
const ROTATION_COUNT_KEY = 'session_rotation_count';

interface RotationResult {
  success: boolean;
  error?: string;
  newSession?: boolean;
}

interface RotationState {
  lastRotation: number;
  rotationCount: number;
  pendingRotation: boolean;
}

// In-memory state
let rotationState: RotationState = {
  lastRotation: 0,
  rotationCount: 0,
  pendingRotation: false,
};

// Rotation timer
let rotationTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Initialize session rotation from stored state
 */
export function initializeSessionRotation(): void {
  try {
    const storedLastRotation = localStorage.getItem(LAST_ROTATION_KEY);
    const storedCount = localStorage.getItem(ROTATION_COUNT_KEY);

    rotationState = {
      lastRotation: storedLastRotation ? parseInt(storedLastRotation, 10) : Date.now(),
      rotationCount: storedCount ? parseInt(storedCount, 10) : 0,
      pendingRotation: false,
    };

    logger.debug('Session rotation initialized', {
      lastRotation: new Date(rotationState.lastRotation).toISOString(),
      rotationCount: rotationState.rotationCount,
    });
  } catch (err) {
    logger.warn('Failed to initialize session rotation state:', err);
    rotationState = {
      lastRotation: Date.now(),
      rotationCount: 0,
      pendingRotation: false,
    };
  }
}

/**
 * Update stored rotation state
 */
function updateRotationState(lastRotation: number, incrementCount: boolean = true): void {
  try {
    rotationState.lastRotation = lastRotation;
    if (incrementCount) {
      rotationState.rotationCount++;
    }

    localStorage.setItem(LAST_ROTATION_KEY, lastRotation.toString());
    localStorage.setItem(ROTATION_COUNT_KEY, rotationState.rotationCount.toString());
  } catch (err) {
    logger.warn('Failed to update rotation state:', err);
  }
}

/**
 * Clear rotation state (on logout)
 */
export function clearRotationState(): void {
  try {
    rotationState = {
      lastRotation: 0,
      rotationCount: 0,
      pendingRotation: false,
    };

    localStorage.removeItem(LAST_ROTATION_KEY);
    localStorage.removeItem(ROTATION_COUNT_KEY);

    if (rotationTimer) {
      clearInterval(rotationTimer);
      rotationTimer = null;
    }

    logger.debug('Session rotation state cleared');
  } catch (err) {
    logger.warn('Failed to clear rotation state:', err);
  }
}

/**
 * Check if session rotation is needed based on time
 */
export function isRotationNeeded(): boolean {
  const timeSinceLastRotation = Date.now() - rotationState.lastRotation;
  return timeSinceLastRotation >= SESSION_ROTATION_INTERVAL;
}

/**
 * Get time until next scheduled rotation
 */
export function getTimeUntilRotation(): number {
  const timeSinceLastRotation = Date.now() - rotationState.lastRotation;
  return Math.max(0, SESSION_ROTATION_INTERVAL - timeSinceLastRotation);
}

/**
 * Rotate session token
 * Uses Supabase's refreshSession to get a new token while maintaining the session
 */
export async function rotateSession(reason: string = 'scheduled'): Promise<RotationResult> {
  // Prevent concurrent rotations
  if (rotationState.pendingRotation) {
    logger.debug('Rotation already in progress, skipping');
    return { success: true, newSession: false };
  }

  rotationState.pendingRotation = true;

  try {
    logger.info('Starting session rotation', { reason });

    // Get current session
    const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !currentSession) {
      logger.warn('No active session to rotate', { error: sessionError?.message });
      return { success: false, error: 'No active session' };
    }

    // Refresh the session to get new tokens
    const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError || !newSession) {
      logger.error('Failed to rotate session', { error: refreshError?.message });
      return { success: false, error: refreshError?.message || 'Rotation failed' };
    }

    // Update rotation state
    updateRotationState(Date.now());

    logger.info('Session rotated successfully', {
      reason,
      rotationCount: rotationState.rotationCount,
      newExpiry: newSession.expires_at ? new Date(newSession.expires_at * 1000).toISOString() : 'unknown',
    });

    // Notify admin-auth about the rotation (for session tracking)
    try {
      await invokeEdgeFunction('admin-auth', {
        body: {
          action: 'session_rotated',
          rotationReason: reason,
          rotationCount: rotationState.rotationCount,
        },
      });
    } catch {
      // Non-critical, just log
      logger.debug('Failed to notify server of session rotation');
    }

    return { success: true, newSession: true };
  } catch (err) {
    logger.error('Session rotation error:', err);
    return { success: false, error: 'Unexpected error during rotation' };
  } finally {
    rotationState.pendingRotation = false;
  }
}

/**
 * Rotate session after a sensitive operation
 */
export async function rotateAfterSensitiveOperation(operation: SensitiveOperation): Promise<RotationResult> {
  logger.info('Rotating session after sensitive operation', { operation });
  return rotateSession(`sensitive_operation:${operation}`);
}

/**
 * Start periodic session rotation
 * Should be called after successful authentication
 */
export function startPeriodicRotation(): void {
  // Clear any existing timer
  if (rotationTimer) {
    clearInterval(rotationTimer);
  }

  // Initialize state if needed
  if (rotationState.lastRotation === 0) {
    initializeSessionRotation();
  }

  // Calculate initial delay based on time since last rotation
  const timeUntilNextRotation = getTimeUntilRotation();

  logger.debug('Starting periodic rotation', {
    timeUntilNextRotation: Math.round(timeUntilNextRotation / 1000),
    interval: Math.round(SESSION_ROTATION_INTERVAL / 1000),
  });

  // If rotation is overdue, do it now
  if (timeUntilNextRotation === 0) {
    rotateSession('scheduled_overdue').catch(err => {
      logger.error('Failed to perform overdue rotation:', err);
    });
  }

  // Set up periodic rotation
  rotationTimer = setInterval(async () => {
    if (isRotationNeeded()) {
      const result = await rotateSession('scheduled');
      if (!result.success) {
        logger.warn('Periodic rotation failed', { error: result.error });
      }
    }
  }, Math.min(SESSION_ROTATION_INTERVAL, 5 * 60 * 1000)); // Check every 5 minutes or rotation interval

  logger.info('Periodic session rotation started');
}

/**
 * Stop periodic session rotation
 * Should be called on logout
 */
export function stopPeriodicRotation(): void {
  if (rotationTimer) {
    clearInterval(rotationTimer);
    rotationTimer = null;
    logger.debug('Periodic rotation stopped');
  }
}

/**
 * Get current rotation statistics
 */
export function getRotationStats(): {
  lastRotation: Date | null;
  rotationCount: number;
  timeUntilNext: number;
  isActive: boolean;
} {
  return {
    lastRotation: rotationState.lastRotation > 0 ? new Date(rotationState.lastRotation) : null,
    rotationCount: rotationState.rotationCount,
    timeUntilNext: getTimeUntilRotation(),
    isActive: rotationTimer !== null,
  };
}

/**
 * React hook helper - provides rotation state and controls
 */
export function useSessionRotation() {
  return {
    rotateSession,
    rotateAfterSensitiveOperation,
    startPeriodicRotation,
    stopPeriodicRotation,
    getRotationStats,
    isRotationNeeded,
  };
}
