/**
 * SecurityAuditContext - Centralized Security Event Tracking
 *
 * This context provides:
 * - Centralized security event logging
 * - Real-time security monitoring
 * - Audit trail for compliance
 * - Suspicious activity detection
 *
 * The 4 Security Layers monitored:
 * 1. Authentication events (login, logout, session expiry)
 * 2. Authorization events (permission checks, role changes)
 * 3. Resource access events (ownership verification)
 * 4. Database events (RLS enforcement)
 */

import React, {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  useRef,
} from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import type {
  ResourceType,
  AccessAction,
  SecurityCheckResult,
} from '@/lib/security-layers';

// ============================================================================
// Types
// ============================================================================

export type SecurityEventType =
  | 'auth_login'
  | 'auth_logout'
  | 'auth_session_expired'
  | 'auth_mfa_verified'
  | 'auth_mfa_failed'
  | 'access_granted'
  | 'access_denied'
  | 'permission_check'
  | 'ownership_verified'
  | 'ownership_denied'
  | 'resource_created'
  | 'resource_updated'
  | 'resource_deleted'
  | 'suspicious_activity'
  | 'rate_limit_exceeded'
  | 'session_rotated';

export interface SecurityEvent {
  id: string;
  type: SecurityEventType;
  timestamp: Date;
  userId?: string;
  email?: string;
  resourceType?: ResourceType;
  resourceId?: string;
  action?: AccessAction;
  layer?: 'authentication' | 'authorization' | 'ownership' | 'rls';
  result?: 'success' | 'failure';
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export interface SecurityStats {
  totalEvents: number;
  successfulAccess: number;
  deniedAccess: number;
  suspiciousActivities: number;
  lastEventTime?: Date;
}

export interface SecurityAuditContextValue {
  /** Log a security event */
  logEvent: (event: Omit<SecurityEvent, 'id' | 'timestamp'>) => void;
  /** Get recent security events */
  recentEvents: SecurityEvent[];
  /** Security statistics */
  stats: SecurityStats;
  /** Clear local event history */
  clearEvents: () => void;
  /** Check if there are any security alerts */
  hasAlerts: boolean;
  /** Dismiss alerts */
  dismissAlerts: () => void;
  /** Enable/disable real-time monitoring */
  setMonitoringEnabled: (enabled: boolean) => void;
  /** Whether monitoring is enabled */
  isMonitoringEnabled: boolean;
}

// ============================================================================
// Context
// ============================================================================

const SecurityAuditContext = createContext<SecurityAuditContextValue | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

interface SecurityAuditProviderProps {
  children: React.ReactNode;
  /** Maximum events to keep in memory */
  maxEvents?: number;
  /** Whether to persist events to database */
  persistEvents?: boolean;
  /** Whether to enable real-time monitoring */
  enableMonitoring?: boolean;
}

export const SecurityAuditProvider: React.FC<SecurityAuditProviderProps> = ({
  children,
  maxEvents = 100,
  persistEvents = true,
  enableMonitoring = true,
}) => {
  const { adminUser } = useAuth();
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [stats, setStats] = useState<SecurityStats>({
    totalEvents: 0,
    successfulAccess: 0,
    deniedAccess: 0,
    suspiciousActivities: 0,
  });
  const [hasAlerts, setHasAlerts] = useState(false);
  const [isMonitoringEnabled, setMonitoringEnabled] = useState(enableMonitoring);

  // Use ref for event queue to batch database writes
  const eventQueue = useRef<SecurityEvent[]>([]);
  const flushTimerRef = useRef<number | null>(null);

  // Generate unique event ID
  const generateEventId = useCallback(() => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Flush event queue to database
  const flushEventQueue = useCallback(async () => {
    if (eventQueue.current.length === 0) return;

    const eventsToFlush = [...eventQueue.current];
    eventQueue.current = [];

    if (!persistEvents) return;

    try {
      const dbEvents = eventsToFlush.map(event => ({
        event_type: event.type,
        user_id: event.userId,
        email: event.email,
        resource_type: event.resourceType,
        resource_id: event.resourceId,
        action: event.action,
        layer: event.layer,
        result: event.result,
        details: event.details,
        ip_address: event.ipAddress,
        user_agent: event.userAgent,
        created_at: event.timestamp.toISOString(),
      }));

      const { error } = await supabase.from('security_events').insert(dbEvents);

      if (error) {
        logger.error('Failed to persist security events:', error);
        // Re-queue failed events
        eventQueue.current = [...eventsToFlush, ...eventQueue.current];
      }
    } catch (error) {
      logger.error('Error flushing security events:', error);
    }
  }, [persistEvents]);

  // Schedule flush
  const scheduleFlush = useCallback(() => {
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
    }

    flushTimerRef.current = window.setTimeout(() => {
      flushEventQueue();
    }, 5000); // Flush every 5 seconds
  }, [flushEventQueue]);

  // Log a security event
  const logEvent = useCallback(
    (eventData: Omit<SecurityEvent, 'id' | 'timestamp'>) => {
      const event: SecurityEvent = {
        ...eventData,
        id: generateEventId(),
        timestamp: new Date(),
        userId: eventData.userId || adminUser?.id,
        email: eventData.email || adminUser?.email,
        userAgent: navigator.userAgent,
      };

      // Add to local state
      setEvents(prev => {
        const updated = [event, ...prev].slice(0, maxEvents);
        return updated;
      });

      // Update stats
      setStats(prev => {
        const newStats = {
          ...prev,
          totalEvents: prev.totalEvents + 1,
          lastEventTime: event.timestamp,
        };

        if (event.result === 'success' || event.type === 'access_granted') {
          newStats.successfulAccess = prev.successfulAccess + 1;
        } else if (event.result === 'failure' || event.type === 'access_denied') {
          newStats.deniedAccess = prev.deniedAccess + 1;
        }

        if (event.type === 'suspicious_activity') {
          newStats.suspiciousActivities = prev.suspiciousActivities + 1;
          setHasAlerts(true);
        }

        return newStats;
      });

      // Add to queue for database persistence
      eventQueue.current.push(event);
      scheduleFlush();

      // Log to console in development
      logger.debug('Security event:', event.type, event);
    },
    [adminUser, generateEventId, maxEvents, scheduleFlush]
  );

  // Clear local events
  const clearEvents = useCallback(() => {
    setEvents([]);
    setStats({
      totalEvents: 0,
      successfulAccess: 0,
      deniedAccess: 0,
      suspiciousActivities: 0,
    });
  }, []);

  // Dismiss alerts
  const dismissAlerts = useCallback(() => {
    setHasAlerts(false);
  }, []);

  // Subscribe to real-time security events (if monitoring enabled)
  useEffect(() => {
    if (!isMonitoringEnabled) return;

    const channel = supabase
      .channel('security_events')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'security_events',
        },
        (payload) => {
          const newEvent = payload.new as Record<string, unknown>;

          // Only process events from other sessions
          if (newEvent.user_id === adminUser?.id) return;

          // Check for suspicious activity targeting current user
          if (
            newEvent.event_type === 'suspicious_activity' ||
            newEvent.event_type === 'access_denied'
          ) {
            setHasAlerts(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isMonitoringEnabled, adminUser?.id]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
      }
      // Flush remaining events
      flushEventQueue();
    };
  }, [flushEventQueue]);

  const value: SecurityAuditContextValue = {
    logEvent,
    recentEvents: events,
    stats,
    clearEvents,
    hasAlerts,
    dismissAlerts,
    setMonitoringEnabled,
    isMonitoringEnabled,
  };

  return (
    <SecurityAuditContext.Provider value={value}>
      {children}
    </SecurityAuditContext.Provider>
  );
};

// ============================================================================
// Hook
// ============================================================================

export function useSecurityAudit(): SecurityAuditContextValue {
  const context = useContext(SecurityAuditContext);

  if (!context) {
    throw new Error('useSecurityAudit must be used within SecurityAuditProvider');
  }

  return context;
}

// ============================================================================
// Helper Hooks
// ============================================================================

/**
 * Hook to log access events easily
 */
export function useAccessLogger(resourceType: ResourceType) {
  const { logEvent } = useSecurityAudit();

  const logAccess = useCallback(
    (action: AccessAction, resourceId?: string, result: 'success' | 'failure' = 'success') => {
      logEvent({
        type: result === 'success' ? 'access_granted' : 'access_denied',
        resourceType,
        resourceId,
        action,
        result,
        layer: 'authorization',
      });
    },
    [logEvent, resourceType]
  );

  const logResourceMutation = useCallback(
    (mutationType: 'created' | 'updated' | 'deleted', resourceId: string) => {
      logEvent({
        type: `resource_${mutationType}` as SecurityEventType,
        resourceType,
        resourceId,
        action: mutationType === 'created' ? 'create' : mutationType === 'updated' ? 'update' : 'delete',
        result: 'success',
        layer: 'ownership',
      });
    },
    [logEvent, resourceType]
  );

  return {
    logAccess,
    logResourceMutation,
  };
}

/**
 * Hook to detect and log suspicious activity
 */
export function useSuspiciousActivityDetector() {
  const { logEvent } = useSecurityAudit();
  const failedAttemptsRef = useRef<{ timestamp: number; action: string }[]>([]);

  const recordFailedAttempt = useCallback(
    (action: string) => {
      const now = Date.now();
      const recentWindow = 5 * 60 * 1000; // 5 minutes

      // Clean up old attempts
      failedAttemptsRef.current = failedAttemptsRef.current.filter(
        attempt => now - attempt.timestamp < recentWindow
      );

      // Add new attempt
      failedAttemptsRef.current.push({ timestamp: now, action });

      // Check for suspicious pattern (5+ failures in 5 minutes)
      if (failedAttemptsRef.current.length >= 5) {
        logEvent({
          type: 'suspicious_activity',
          details: {
            pattern: 'multiple_failed_attempts',
            attempts: failedAttemptsRef.current.length,
            actions: [...new Set(failedAttemptsRef.current.map(a => a.action))],
          },
          result: 'failure',
        });

        // Reset counter after logging
        failedAttemptsRef.current = [];
      }
    },
    [logEvent]
  );

  return {
    recordFailedAttempt,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default SecurityAuditContext;
