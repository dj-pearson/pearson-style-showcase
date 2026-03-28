/**
 * Session Token Rotation Service
 *
 * Provides session token rotation for enhanced security:
 * - Rotates tokens after sensitive operations (password change, permission change)
 * - Periodic rotation based on configurable interval
 * - Maintains session continuity during rotation
 * - Multi-tab safe via localStorage-based distributed lock
 * - Inter-tab communication via storage events
 */

import { supabase } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edge-functions';
import { logger } from '@/lib/logger';

// Configuration
const SESSION_ROTATION_INTERVAL = 30 * 60 * 1000; // 30 minutes
const LOCK_TIMEOUT_MS = 30 * 1000; // 30 second lock timeout to prevent hung rotations
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
const ROTATION_LOCK_KEY = 'session_rotation_lock';
const ROTATION_COMPLETED_KEY = 'session_rotation_completed';

interface RotationResult {
  success: boolean;
  error?: string;
  newSession?: boolean;
}

interface RotationState {
  lastRotation: number;
  rotationCount: number;
}

interface RotationLock {
  tabId: string;
  timestamp: number;
  version: number; // Monotonic version for CAS
}

// Unique ID for this browser tab
const TAB_ID = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// In-memory state
let rotationState: RotationState = {
  lastRotation: 0,
  rotationCount: 0,
};

// Rotation timer
let rotationTimer: ReturnType<typeof setInterval> | null = null;

// Storage event listener reference for cleanup
let storageListener: ((event: StorageEvent) => void) | null = null;

/**
 * Acquire a distributed lock using localStorage with Compare-And-Set (CAS).
 * Uses a monotonic version number to eliminate the TOCTOU window:
 * 1. Read the current lock and its version
 * 2. Write a new lock with version+1
 * 3. Re-read and verify our version won (atomic CAS check)
 * Returns true if lock was acquired, false if another tab holds it.
 */
function acquireRotationLock(): boolean {
  try {
    const existingLockStr = localStorage.getItem(ROTATION_LOCK_KEY);
    let nextVersion = 1;

    if (existingLockStr) {
      const lock: RotationLock = JSON.parse(existingLockStr);

      // Check if lock is expired (hung rotation)
      if (Date.now() - lock.timestamp < LOCK_TIMEOUT_MS) {
        if (lock.tabId === TAB_ID) {
          return true; // We already hold the lock
        }
        logger.debug('Rotation lock held by another tab', { lockTabId: lock.tabId });
        return false;
      }

      // Lock expired - take over with incremented version
      logger.warn('Rotation lock expired, taking over from stale lock', {
        staleTabId: lock.tabId,
        lockAge: Date.now() - lock.timestamp,
      });
      nextVersion = (lock.version || 0) + 1;
    }

    // Write our lock with the next version (CAS write)
    const newLock: RotationLock = {
      tabId: TAB_ID,
      timestamp: Date.now(),
      version: nextVersion,
    };
    localStorage.setItem(ROTATION_LOCK_KEY, JSON.stringify(newLock));

    // CAS verification: re-read and check version matches what we wrote
    // If another tab wrote between our read and write, their version will differ
    const verifyStr = localStorage.getItem(ROTATION_LOCK_KEY);
    if (verifyStr) {
      const verified: RotationLock = JSON.parse(verifyStr);
      if (verified.tabId !== TAB_ID || verified.version !== nextVersion) {
        // Another tab won the race - their write overwrote ours
        return false;
      }
    }

    return true;
  } catch (err) {
    logger.warn('Failed to acquire rotation lock:', err);
    return false;
  }
}

/**
 * Release the distributed lock (only if we hold it)
 */
function releaseRotationLock(): void {
  try {
    const existingLock = localStorage.getItem(ROTATION_LOCK_KEY);
    if (existingLock) {
      const lock: RotationLock = JSON.parse(existingLock);
      if (lock.tabId === TAB_ID) {
        localStorage.removeItem(ROTATION_LOCK_KEY);
      }
    }
  } catch (err) {
    logger.warn('Failed to release rotation lock:', err);
  }
}

/**
 * Notify other tabs that rotation completed via a storage event signal
 */
function notifyRotationCompleted(): void {
  try {
    // Writing to localStorage triggers 'storage' events in other tabs
    localStorage.setItem(ROTATION_COMPLETED_KEY, Date.now().toString());
  } catch {
    // Non-critical
  }
}

/**
 * Listen for rotation completion from other tabs
 */
function setupInterTabListener(): void {
  if (storageListener) return; // Already listening

  storageListener = (event: StorageEvent) => {
    // Another tab completed a rotation - update our local state
    if (event.key === ROTATION_COMPLETED_KEY && event.newValue) {
      const completedAt = parseInt(event.newValue, 10);
      if (!isNaN(completedAt)) {
        logger.debug('Rotation completed by another tab, updating local state');
        syncRotationStateFromStorage();
      }
    }

    // Another tab cleared rotation state (logout)
    if (event.key === LAST_ROTATION_KEY && event.newValue === null) {
      logger.debug('Rotation state cleared by another tab (logout)');
      rotationState = {
        lastRotation: 0,
        rotationCount: 0,
      };
      stopPeriodicRotation();
    }
  };

  window.addEventListener('storage', storageListener);
}

/**
 * Remove inter-tab listener
 */
function removeInterTabListener(): void {
  if (storageListener) {
    window.removeEventListener('storage', storageListener);
    storageListener = null;
  }
}

/**
 * Sync rotation state from localStorage (used after another tab rotates)
 */
function syncRotationStateFromStorage(): void {
  try {
    const storedLastRotation = localStorage.getItem(LAST_ROTATION_KEY);
    const storedCount = localStorage.getItem(ROTATION_COUNT_KEY);

    if (storedLastRotation) {
      rotationState.lastRotation = parseInt(storedLastRotation, 10);
    }
    if (storedCount) {
      rotationState.rotationCount = parseInt(storedCount, 10);
    }
  } catch {
    // Non-critical
  }
}

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
    };

    // Set up inter-tab communication
    setupInterTabListener();

    logger.debug('Session rotation initialized', {
      lastRotation: new Date(rotationState.lastRotation).toISOString(),
      rotationCount: rotationState.rotationCount,
      tabId: TAB_ID,
    });
  } catch (err) {
    logger.warn('Failed to initialize session rotation state:', err);
    rotationState = {
      lastRotation: Date.now(),
      rotationCount: 0,
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
    };

    localStorage.removeItem(LAST_ROTATION_KEY);
    localStorage.removeItem(ROTATION_COUNT_KEY);
    releaseRotationLock();
    removeInterTabListener();

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
  // Re-sync from storage in case another tab rotated recently
  syncRotationStateFromStorage();
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
 * Uses localStorage-based distributed lock for multi-tab safety.
 * If rotation fails, the previous session token remains valid (no invalidation).
 */
export async function rotateSession(reason: string = 'scheduled'): Promise<RotationResult> {
  // Acquire distributed lock (prevents concurrent rotations across tabs)
  if (!acquireRotationLock()) {
    logger.debug('Rotation lock held by another tab, skipping');
    return { success: true, newSession: false };
  }

  try {
    logger.info('Starting session rotation', { reason, tabId: TAB_ID });

    // Get current session
    const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError || !currentSession) {
      logger.warn('No active session to rotate', { error: sessionError?.message });
      return { success: false, error: 'No active session' };
    }

    // Refresh the session to get new tokens
    const { data: { session: newSession }, error: refreshError } = await supabase.auth.refreshSession();

    if (refreshError || !newSession) {
      // SECURITY: On failure, preserve the previous session rather than invalidating
      // This prevents failed rotations from logging users out
      logger.error('Failed to rotate session, preserving previous token', { error: refreshError?.message });
      return { success: false, error: refreshError?.message || 'Rotation failed' };
    }

    // Update rotation state
    updateRotationState(Date.now());

    // Notify other tabs that rotation completed
    notifyRotationCompleted();

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
    // SECURITY: On unexpected error, preserve the previous session
    logger.error('Session rotation error:', err);
    return { success: false, error: 'Unexpected error during rotation' };
  } finally {
    releaseRotationLock();
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

  // Ensure inter-tab listener is active
  setupInterTabListener();

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
