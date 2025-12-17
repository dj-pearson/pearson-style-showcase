import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Progress } from '@/components/ui/progress';
import { Clock, RefreshCw, LogOut } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

// Configuration
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours (matches Supabase default)
const WARNING_BEFORE_EXPIRY = 5 * 60 * 1000; // Show warning 5 minutes before expiry
const CHECK_INTERVAL = 60 * 1000; // Check every minute
const COUNTDOWN_INTERVAL = 1000; // Update countdown every second

interface SessionTimeoutWarningProps {
  onSessionExtended?: () => void;
  onSessionExpired?: () => void;
}

const SessionTimeoutWarning: React.FC<SessionTimeoutWarningProps> = ({
  onSessionExtended,
  onSessionExpired,
}) => {
  const { session, signOut, isAuthenticated } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [isExtending, setIsExtending] = useState(false);
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const warningTriggeredRef = useRef(false);

  /**
   * Calculate time until session expires
   */
  const getTimeUntilExpiry = useCallback((): number => {
    if (!session?.expires_at) return SESSION_DURATION;

    const expiresAt = session.expires_at * 1000; // Convert to milliseconds
    const now = Date.now();
    return Math.max(0, expiresAt - now);
  }, [session]);

  /**
   * Format remaining time for display
   */
  const formatTimeRemaining = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${seconds}s`;
  };

  /**
   * Extend the session by refreshing the token
   */
  const extendSession = useCallback(async () => {
    setIsExtending(true);

    try {
      logger.info('Extending session...');

      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        logger.error('Failed to extend session:', error);
        throw error;
      }

      if (data.session) {
        logger.info('Session extended successfully');
        setShowWarning(false);
        warningTriggeredRef.current = false;
        onSessionExtended?.();
      }
    } catch (error) {
      logger.error('Session extension failed:', error);
      // If extension fails, session may have expired
      handleSessionExpired();
    } finally {
      setIsExtending(false);
    }
  }, [onSessionExtended]);

  /**
   * Handle session expiration
   */
  const handleSessionExpired = useCallback(async () => {
    logger.warn('Session expired');
    setShowWarning(false);
    onSessionExpired?.();
    await signOut();
  }, [signOut, onSessionExpired]);

  /**
   * Handle user choosing to logout
   */
  const handleLogout = useCallback(async () => {
    setShowWarning(false);
    await signOut();
  }, [signOut]);

  /**
   * Check session expiry status
   */
  const checkSessionExpiry = useCallback(() => {
    if (!isAuthenticated || !session) {
      setShowWarning(false);
      return;
    }

    const remaining = getTimeUntilExpiry();

    // Session has expired
    if (remaining <= 0) {
      handleSessionExpired();
      return;
    }

    // Show warning if we're within the warning period
    if (remaining <= WARNING_BEFORE_EXPIRY && !warningTriggeredRef.current) {
      logger.info('Session expiring soon, showing warning');
      warningTriggeredRef.current = true;
      setTimeRemaining(remaining);
      setShowWarning(true);

      // Start countdown
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }

      countdownIntervalRef.current = setInterval(() => {
        setTimeRemaining((prev) => {
          const newRemaining = Math.max(0, prev - COUNTDOWN_INTERVAL);
          if (newRemaining <= 0) {
            handleSessionExpired();
          }
          return newRemaining;
        });
      }, COUNTDOWN_INTERVAL);
    }
  }, [isAuthenticated, session, getTimeUntilExpiry, handleSessionExpired]);

  // Set up session check interval
  useEffect(() => {
    if (!isAuthenticated) {
      // Clean up if not authenticated
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setShowWarning(false);
      warningTriggeredRef.current = false;
      return;
    }

    // Initial check
    checkSessionExpiry();

    // Set up periodic checks
    checkIntervalRef.current = setInterval(checkSessionExpiry, CHECK_INTERVAL);

    return () => {
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
        checkIntervalRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, checkSessionExpiry]);

  // Clean up countdown when warning is dismissed
  useEffect(() => {
    if (!showWarning && countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, [showWarning]);

  // Don't render anything if not authenticated or no warning to show
  if (!isAuthenticated || !showWarning) {
    return null;
  }

  const progressValue = (timeRemaining / WARNING_BEFORE_EXPIRY) * 100;

  return (
    <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
      <AlertDialogContent className="sm:max-w-[425px]">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
            <Clock className="h-5 w-5" />
            Session Expiring Soon
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4">
            <p>
              Your session will expire in{' '}
              <span className="font-bold text-foreground">
                {formatTimeRemaining(timeRemaining)}
              </span>
              . Would you like to extend your session?
            </p>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Time remaining</span>
                <span>{formatTimeRemaining(timeRemaining)}</span>
              </div>
              <Progress value={progressValue} className="h-2" />
            </div>

            <p className="text-xs text-muted-foreground">
              If you don't respond, you will be automatically logged out when
              the session expires.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel
            onClick={handleLogout}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout Now
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={extendSession}
            disabled={isExtending}
            className="flex items-center gap-2 bg-primary"
          >
            {isExtending ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Extending...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Extend Session
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SessionTimeoutWarning;
