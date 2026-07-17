/**
 * SecureRoute - Enhanced Protected Route with Defense-in-Depth Security
 *
 * This component implements all 4 security layers:
 *
 * Layer 1: Authentication (WHO are you?)
 * - Validates JWT/session is valid
 * - Checks session expiry and rotation
 *
 * Layer 2: Authorization (WHAT can you do?)
 * - Permission-based access control
 * - Role level checks
 *
 * Layer 3: Resource Ownership (IS this yours?)
 * - Tenant/organization filtering
 * - Owner checks for "own" access patterns
 *
 * Layer 4: Database RLS (FINAL enforcement)
 * - Row-level security policies in PostgreSQL
 * - Even if code has bugs, DB rejects unauthorized access
 */

import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { Loader2, ShieldAlert, Lock } from 'lucide-react';
import {
  runSecurityCheck,
  logSecurityEvent,
  type ResourceType,
  type AccessAction,
  type SecurityCheckResult,
} from '@/lib/security-layers';
import {
  checkPermission,
  meetsRoleLevel,
  getHighestRoleLevel,
  type AuthorizationResult,
} from '@/lib/authorization';

// ============================================================================
// Types
// ============================================================================

interface SecureRouteProps {
  children: React.ReactNode;
  /** Require admin verification */
  requireAdmin?: boolean;
  /** Require specific role(s) */
  requireRole?: AppRole | AppRole[];
  /** Require specific permission(s) */
  requirePermission?: string | string[];
  /** Require ALL permissions (default: any) */
  requireAllPermissions?: boolean;
  /** Minimum role level required */
  requireRoleLevel?: number;
  /** Resource type for ownership checks */
  resourceType?: ResourceType;
  /** Action being performed */
  resourceAction?: AccessAction;
  /** Redirect path on failure */
  redirectTo?: string;
  /** Custom fallback component on permission failure */
  fallback?: React.ReactNode;
  /** Show detailed security info (dev mode) */
  showSecurityInfo?: boolean;
  /** Log security events */
  logEvents?: boolean;
  /** Custom access denied component */
  accessDeniedComponent?: React.ReactNode;
}

interface SecurityState {
  checking: boolean;
  result: SecurityCheckResult | null;
  authResult: AuthorizationResult | null;
}

// ============================================================================
// Access Denied Component
// ============================================================================

const AccessDenied: React.FC<{
  reason?: string;
  showDetails?: boolean;
  result?: SecurityCheckResult | null;
}> = ({ reason, showDetails, result }) => {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="flex flex-col items-center gap-4 max-w-md p-8 text-center">
        <div className="p-4 rounded-full bg-destructive/10">
          <ShieldAlert className="h-12 w-12 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Access Denied</h1>
        <p className="text-muted-foreground">
          {reason || 'You do not have permission to access this resource.'}
        </p>

        {showDetails && result && (
          <div className="mt-4 p-4 bg-muted rounded-lg text-left w-full">
            <h3 className="font-medium mb-2">Security Check Details:</h3>
            <ul className="text-sm space-y-1">
              {result.layers.map((layer, index) => (
                <li key={index} className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      layer.passed ? 'bg-green-500' : 'bg-red-500'
                    }`}
                  />
                  <span className="capitalize">{layer.layer}:</span>
                  <span className={layer.passed ? 'text-green-600' : 'text-red-600'}>
                    {layer.passed ? 'Passed' : layer.error}
                  </span>
                </li>
              ))}
            </ul>
            {result.failedAt && (
              <p className="mt-2 text-sm text-destructive">
                Failed at: <strong className="capitalize">{result.failedAt}</strong>
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 text-sm font-medium rounded-md bg-secondary text-secondary-foreground hover:bg-secondary/80"
          >
            Go Back
          </button>
          <a
            href="/admin/login"
            className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            Sign In
          </a>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SecureRoute Component
// ============================================================================

export const SecureRoute: React.FC<SecureRouteProps> = ({
  children,
  requireAdmin = false,
  requireRole,
  requirePermission,
  requireAllPermissions = false,
  requireRoleLevel,
  resourceType,
  resourceAction = 'read',
  redirectTo = '/admin/login',
  fallback,
  showSecurityInfo = false,
  logEvents = true,
  accessDeniedComponent,
}) => {
  const {
    authStatus,
    isAuthenticated,
    isAdminVerified,
    adminUser,
    hasRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    roles,
    permissions,
  } = useAuth();
  const location = useLocation();

  const [securityState, setSecurityState] = useState<SecurityState>({
    checking: true,
    result: null,
    authResult: null,
  });

  // Run security checks
  useEffect(() => {
    const runChecks = async () => {
      // Wait for auth to initialize
      if (authStatus === 'initializing' || authStatus === 'verifying_admin') {
        return;
      }

      // Layer 1: Authentication Check
      if (!isAuthenticated) {
        setSecurityState({
          checking: false,
          result: {
            authorized: false,
            layers: [{ passed: false, layer: 'authentication', error: 'Not authenticated' }],
            failedAt: 'authentication',
            error: 'Not authenticated',
          },
          authResult: null,
        });
        return;
      }

      // Layer 2: Authorization Checks

      // Check admin requirement
      const needsAdminAccess = requireAdmin || requireRole || requirePermission || requireRoleLevel;

      if (needsAdminAccess && (!isAdminVerified || !adminUser)) {
        setSecurityState({
          checking: false,
          result: {
            authorized: false,
            layers: [
              { passed: true, layer: 'authentication' },
              { passed: false, layer: 'authorization', error: 'Admin access required' },
            ],
            failedAt: 'authorization',
            error: 'Admin access required',
          },
          authResult: { authorized: false, reason: 'Admin access required' },
        });
        return;
      }

      // Check role level requirement
      if (requireRoleLevel !== undefined) {
        const meetsLevel = meetsRoleLevel(roles, requireRoleLevel);
        const userLevel = getHighestRoleLevel(roles);

        if (!meetsLevel) {
          setSecurityState({
            checking: false,
            result: {
              authorized: false,
              layers: [
                { passed: true, layer: 'authentication' },
                {
                  passed: false,
                  layer: 'authorization',
                  error: `Role level ${requireRoleLevel} required (you have ${userLevel})`,
                },
              ],
              failedAt: 'authorization',
              error: `Insufficient role level`,
            },
            authResult: { authorized: false, reason: 'Insufficient role level' },
          });
          return;
        }
      }

      // Check role requirement
      if (requireRole) {
        const hasRequiredRole = Array.isArray(requireRole)
          ? requireRole.some(role => hasRole(role))
          : hasRole(requireRole);

        if (!hasRequiredRole) {
          const requiredRoles = Array.isArray(requireRole) ? requireRole.join(', ') : requireRole;
          setSecurityState({
            checking: false,
            result: {
              authorized: false,
              layers: [
                { passed: true, layer: 'authentication' },
                {
                  passed: false,
                  layer: 'authorization',
                  error: `Required role(s): ${requiredRoles}`,
                },
              ],
              failedAt: 'authorization',
              error: 'Required role not present',
            },
            authResult: { authorized: false, reason: 'Required role not present' },
          });
          return;
        }
      }

      // Check permission requirement
      if (requirePermission) {
        const requiredPerms = Array.isArray(requirePermission)
          ? requirePermission
          : [requirePermission];

        const hasRequiredPermission = requireAllPermissions
          ? hasAllPermissions(requiredPerms)
          : hasAnyPermission(requiredPerms);

        if (!hasRequiredPermission) {
          // Perform detailed permission check
          const authResult = checkPermission(permissions, roles, requiredPerms[0]);

          setSecurityState({
            checking: false,
            result: {
              authorized: false,
              layers: [
                { passed: true, layer: 'authentication' },
                {
                  passed: false,
                  layer: 'authorization',
                  error: `Required permission(s): ${requiredPerms.join(', ')}`,
                },
              ],
              failedAt: 'authorization',
              error: 'Required permission not present',
            },
            authResult,
          });
          return;
        }
      }

      // Layer 3 & 4: Resource ownership and RLS (if resource type specified)
      if (resourceType) {
        const result = await runSecurityCheck(resourceType, resourceAction);

        if (!result.authorized) {
          setSecurityState({
            checking: false,
            result,
            authResult: { authorized: false, reason: result.error },
          });

          // Log security event
          if (logEvents && adminUser?.id) {
            await logSecurityEvent({
              type: 'access_denied',
              resourceType,
              action: resourceAction,
              userId: adminUser.id,
              result,
              timestamp: new Date(),
              metadata: { path: location.pathname },
            });
          }

          return;
        }
      }

      // All checks passed
      const successResult: SecurityCheckResult = {
        authorized: true,
        layers: [
          { passed: true, layer: 'authentication' },
          { passed: true, layer: 'authorization' },
          ...(resourceType
            ? [
                { passed: true, layer: 'ownership' as const },
                { passed: true, layer: 'rls' as const },
              ]
            : []),
        ],
      };

      setSecurityState({
        checking: false,
        result: successResult,
        authResult: { authorized: true },
      });

      // Log successful access
      if (logEvents && adminUser?.id && resourceType) {
        await logSecurityEvent({
          type: 'access_granted',
          resourceType,
          action: resourceAction,
          userId: adminUser.id,
          result: successResult,
          timestamp: new Date(),
          metadata: { path: location.pathname },
        });
      }
    };

    runChecks();
  }, [
    authStatus,
    isAuthenticated,
    isAdminVerified,
    adminUser,
    requireAdmin,
    requireRole,
    requirePermission,
    requireAllPermissions,
    requireRoleLevel,
    resourceType,
    resourceAction,
    roles,
    permissions,
    hasRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    location.pathname,
    logEvents,
  ]);

  // Still initializing or verifying - show loading
  if (authStatus === 'initializing' || authStatus === 'verifying_admin' || securityState.checking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {authStatus === 'initializing'
              ? 'Loading...'
              : authStatus === 'verifying_admin'
              ? 'Verifying access...'
              : 'Checking security...'}
          </p>
          {showSecurityInfo && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" />
              <span>Running security checks...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    logger.debug('SecureRoute: Not authenticated, redirecting to login');

    // Store the current location for post-login redirect
    const returnUrl = `${location.pathname}${location.search}${location.hash}`;
    sessionStorage.setItem('auth_return_url', returnUrl);

    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Security check failed
  if (securityState.result && !securityState.result.authorized) {
    logger.warn('SecureRoute: Security check failed', {
      failedAt: securityState.result.failedAt,
      error: securityState.result.error,
    });

    // Use custom fallback if provided
    if (fallback) {
      return <>{fallback}</>;
    }

    // Use custom access denied component if provided
    if (accessDeniedComponent) {
      return <>{accessDeniedComponent}</>;
    }

    // Show access denied page
    return (
      <AccessDenied
        reason={securityState.result.error}
        showDetails={showSecurityInfo}
        result={securityState.result}
      />
    );
  }

  // All checks passed - render the protected content
  return <>{children}</>;
};

// ============================================================================
// Utility Hooks
// ============================================================================

/**
 * Hook to check if current route requires admin access
 */
export const useRequiresAdmin = () => {
  const location = useLocation();
  return location.pathname.startsWith('/admin/');
};

/**
 * Hook to get current security status
 */
export const useSecurityStatus = () => {
  const { authStatus, isAuthenticated, isAdminVerified, roles, permissions } = useAuth();

  return {
    isInitializing: authStatus === 'initializing' || authStatus === 'verifying_admin',
    isAuthenticated,
    isAdminVerified,
    roles,
    permissions,
    roleLevel: getHighestRoleLevel(roles),
  };
};

export default SecureRoute;
