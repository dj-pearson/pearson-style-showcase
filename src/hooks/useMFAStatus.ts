import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

interface MFAFactor {
  id: string;
  type: 'totp';
  status: 'verified' | 'unverified';
  friendlyName?: string;
  createdAt: string;
}

interface MFAStatus {
  isEnabled: boolean;
  isLoading: boolean;
  error: string | null;
  factors: MFAFactor[];
  requiresSetup: boolean;
  gracePeriodRemaining: number | null;
}

interface UseMFAStatusOptions {
  requireMFA?: boolean;
  gracePeriodDays?: number;
  checkOnMount?: boolean;
}

const MFA_SETUP_DATE_KEY = 'mfa_setup_reminder_date';

/**
 * Hook to check and manage MFA status for the current user
 */
export function useMFAStatus(options: UseMFAStatusOptions = {}): MFAStatus & {
  checkMFAStatus: () => Promise<void>;
  dismissReminder: () => void;
} {
  const { requireMFA = true, gracePeriodDays = 7, checkOnMount = true } = options;
  const { user, isAuthenticated, isAdminVerified } = useAuth();

  const [isEnabled, setIsEnabled] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [factors, setFactors] = useState<MFAFactor[]>([]);
  const [gracePeriodRemaining, setGracePeriodRemaining] = useState<number | null>(null);

  /**
   * Calculate remaining grace period days
   */
  const calculateGracePeriod = useCallback((): number | null => {
    if (!requireMFA || gracePeriodDays <= 0) return null;

    try {
      const setupDateStr = localStorage.getItem(MFA_SETUP_DATE_KEY);

      if (!setupDateStr) {
        // First time - set the reminder date
        localStorage.setItem(MFA_SETUP_DATE_KEY, new Date().toISOString());
        return gracePeriodDays;
      }

      const setupDate = new Date(setupDateStr);
      const now = new Date();
      const daysPassed = Math.floor(
        (now.getTime() - setupDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const remaining = Math.max(0, gracePeriodDays - daysPassed);
      return remaining;
    } catch {
      return gracePeriodDays;
    }
  }, [gracePeriodDays, requireMFA]);

  /**
   * Dismiss the MFA reminder for the grace period
   */
  const dismissReminder = useCallback(() => {
    // Reset the reminder date to extend grace period
    localStorage.setItem(MFA_SETUP_DATE_KEY, new Date().toISOString());
    setGracePeriodRemaining(gracePeriodDays);
    logger.info('MFA reminder dismissed, grace period reset');
  }, [gracePeriodDays]);

  /**
   * Check MFA status from Supabase
   */
  const checkMFAStatus = useCallback(async () => {
    if (!isAuthenticated || !user) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const { data, error: mfaError } = await supabase.auth.mfa.listFactors();

      if (mfaError) {
        logger.error('Failed to fetch MFA factors:', mfaError);
        setError(mfaError.message);
        setIsLoading(false);
        return;
      }

      // Map TOTP factors
      const totpFactors: MFAFactor[] = data.totp.map((factor) => ({
        id: factor.id,
        type: 'totp' as const,
        status: factor.status as 'verified' | 'unverified',
        friendlyName: factor.friendly_name || undefined,
        createdAt: factor.created_at,
      }));

      setFactors(totpFactors);

      // Check if MFA is enabled (has verified factors)
      const hasVerifiedFactor = totpFactors.some(
        (f) => f.status === 'verified'
      );
      setIsEnabled(hasVerifiedFactor);

      // Calculate grace period if MFA is required but not enabled
      if (requireMFA && !hasVerifiedFactor) {
        const remaining = calculateGracePeriod();
        setGracePeriodRemaining(remaining);

        if (remaining !== null && remaining <= 0) {
          logger.warn('MFA grace period expired, enforcement required');
        }
      } else {
        setGracePeriodRemaining(null);
        // Clear the reminder date if MFA is enabled
        if (hasVerifiedFactor) {
          localStorage.removeItem(MFA_SETUP_DATE_KEY);
        }
      }

      logger.debug('MFA status checked', {
        isEnabled: hasVerifiedFactor,
        factorCount: totpFactors.length,
      });
    } catch (err) {
      logger.error('Error checking MFA status:', err);
      setError('Failed to check MFA status');
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user, requireMFA, calculateGracePeriod]);

  // Check MFA status on mount and when auth state changes
  useEffect(() => {
    if (checkOnMount && isAdminVerified) {
      checkMFAStatus();
    }
  }, [checkOnMount, isAdminVerified, checkMFAStatus]);

  // Determine if setup is required
  const requiresSetup =
    requireMFA &&
    !isEnabled &&
    !isLoading &&
    (gracePeriodRemaining === null || gracePeriodRemaining <= 0);

  return {
    isEnabled,
    isLoading,
    error,
    factors,
    requiresSetup,
    gracePeriodRemaining,
    checkMFAStatus,
    dismissReminder,
  };
}

export default useMFAStatus;
