/**
 * withSecurityLayers - Higher-Order Component for Defense-in-Depth Security
 *
 * This HOC wraps admin components with comprehensive security checks:
 *
 * Layer 1: Authentication - Ensures user has valid session
 * Layer 2: Authorization - Checks permissions and role levels
 * Layer 3: Resource Ownership - Verifies access to specific resources
 * Layer 4: Database RLS - Final enforcement at database level
 *
 * Usage:
 * ```tsx
 * const SecureArticleManager = withSecurityLayers(ArticleManager, {
 *   resourceType: 'article',
 *   requiredPermission: 'articles.read',
 *   requireAdmin: true,
 * });
 * ```
 */

import React, { ComponentType, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import {
  runSecurityCheck,
  logSecurityEvent,
  getSecurityContext,
  type ResourceType,
  type AccessAction,
  type SecurityCheckResult,
  type SecurityContext,
} from '@/lib/security-layers';
import {
  meetsRoleLevel,
} from '@/lib/authorization';

// ============================================================================
// Types
// ============================================================================

export interface SecurityLayersConfig {
  /** Resource type for security checks */
  resourceType?: ResourceType;
  /** Default action for the component */
  defaultAction?: AccessAction;
  /** Required permission(s) to access */
  requiredPermission?: string | string[];
  /** Require ALL permissions (default: any) */
  requireAllPermissions?: boolean;
  /** Require admin verification */
  requireAdmin?: boolean;
  /** Minimum role level required */
  requiredRoleLevel?: number;
  /** Custom display name for the component */
  displayName?: string;
  /** Whether to log security events */
  logEvents?: boolean;
  /** Custom loading component */
  LoadingComponent?: ComponentType;
  /** Custom access denied component */
  AccessDeniedComponent?: ComponentType<{ reason?: string }>;
}

export interface SecurityLayerProps {
  /** Current security context */
  securityContext: SecurityContext | null;
  /** Whether user can perform an action */
  canPerform: (action: AccessAction, resource?: Record<string, unknown>) => Promise<boolean>;
  /** Run a security check */
  runCheck: (action: AccessAction, resource?: Record<string, unknown>) => Promise<SecurityCheckResult>;
  /** Log a security event */
  logEvent: (
    type: 'access_granted' | 'access_denied' | 'security_check',
    action: AccessAction,
    resourceId?: string
  ) => Promise<void>;
  /** Check if user has permission */
  hasPermission: (permission: string) => boolean;
  /** Check if user meets role level */
  meetsRoleLevel: (level: number) => boolean;
}

// ============================================================================
// Default Components
// ============================================================================

const DefaultLoading: React.FC = () => (
  <div className="flex items-center justify-center p-8">
    <div className="flex flex-col items-center gap-4">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
      <p className="text-sm text-muted-foreground">Verifying access...</p>
    </div>
  </div>
);

const DefaultAccessDenied: React.FC<{ reason?: string }> = ({ reason }) => (
  <div className="flex items-center justify-center p-8">
    <div className="flex flex-col items-center gap-4 max-w-md text-center">
      <div className="p-3 rounded-full bg-destructive/10">
        <ShieldAlert className="h-8 w-8 text-destructive" />
      </div>
      <h2 className="text-xl font-semibold text-foreground">Access Denied</h2>
      <p className="text-muted-foreground">
        {reason || 'You do not have permission to access this resource.'}
      </p>
    </div>
  </div>
);

// ============================================================================
// Higher-Order Component
// ============================================================================

export function withSecurityLayers<P extends object>(
  WrappedComponent: ComponentType<P & SecurityLayerProps>,
  config: SecurityLayersConfig
): ComponentType<Omit<P, keyof SecurityLayerProps>> {
  const {
    resourceType,
    defaultAction = 'read',
    requiredPermission,
    requireAllPermissions = false,
    requireAdmin = false,
    requiredRoleLevel,
    displayName,
    logEvents = true,
    LoadingComponent = DefaultLoading,
    AccessDeniedComponent = DefaultAccessDenied,
  } = config;

  const ComponentWithSecurityLayers: React.FC<Omit<P, keyof SecurityLayerProps>> = (props) => {
    const {
      authStatus,
      isAuthenticated,
      isAdminVerified,
      adminUser,
      roles,
      permissions,
      hasPermission: authHasPermission,
      hasAnyPermission,
      hasAllPermissions,
    } = useAuth();

    const [isLoading, setIsLoading] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [securityContext, setSecurityContext] = useState<SecurityContext | null>(null);
    const [denialReason, setDenialReason] = useState<string | undefined>();

    // Initialize security context and run checks
    useEffect(() => {
      const initSecurity = async () => {
        // Wait for auth to initialize
        if (authStatus === 'initializing' || authStatus === 'verifying_admin') {
          return;
        }

        setIsLoading(true);

        // Layer 1: Authentication
        if (!isAuthenticated) {
          setDenialReason('Not authenticated');
          setIsAuthorized(false);
          setIsLoading(false);
          return;
        }

        // Layer 2: Admin verification (if required)
        if (requireAdmin && (!isAdminVerified || !adminUser)) {
          setDenialReason('Admin access required');
          setIsAuthorized(false);
          setIsLoading(false);
          return;
        }

        // Layer 2: Role level check
        if (requiredRoleLevel !== undefined) {
          if (!meetsRoleLevel(roles, requiredRoleLevel)) {
            setDenialReason(`Insufficient role level (required: ${requiredRoleLevel})`);
            setIsAuthorized(false);
            setIsLoading(false);
            return;
          }
        }

        // Layer 2: Permission check
        if (requiredPermission) {
          const perms = Array.isArray(requiredPermission)
            ? requiredPermission
            : [requiredPermission];

          const hasPerms = requireAllPermissions
            ? hasAllPermissions(perms)
            : hasAnyPermission(perms);

          if (!hasPerms) {
            setDenialReason(`Missing permission: ${perms.join(', ')}`);
            setIsAuthorized(false);
            setIsLoading(false);
            return;
          }
        }

        // Get security context for child component
        const context = await getSecurityContext();
        setSecurityContext(context);

        // All checks passed
        setIsAuthorized(true);
        setIsLoading(false);

        // Log access
        if (logEvents && adminUser?.id && resourceType) {
          await logSecurityEvent({
            type: 'access_granted',
            resourceType,
            action: defaultAction,
            userId: adminUser.id,
            result: {
              authorized: true,
              layers: [
                { passed: true, layer: 'authentication' },
                { passed: true, layer: 'authorization' },
              ],
            },
            timestamp: new Date(),
          });
        }
      };

      initSecurity();
    }, [
      authStatus,
      isAuthenticated,
      isAdminVerified,
      adminUser,
      roles,
      permissions,
      hasAnyPermission,
      hasAllPermissions,
    ]);

    // Helper: Check if user can perform an action
    const canPerform = useCallback(
      async (
        action: AccessAction,
        resource?: Record<string, unknown>
      ): Promise<boolean> => {
        if (!securityContext || !resourceType) return false;

        const result = await runSecurityCheck(resourceType, action, resource);
        return result.authorized;
      },
      [securityContext]
    );

    // Helper: Run a security check
    const runCheck = useCallback(
      async (
        action: AccessAction,
        resource?: Record<string, unknown>
      ): Promise<SecurityCheckResult> => {
        if (!resourceType) {
          return {
            authorized: true,
            layers: [{ passed: true, layer: 'authentication' }],
          };
        }

        return runSecurityCheck(resourceType, action, resource);
      },
      []
    );

    // Helper: Log a security event
    const logEvent = useCallback(
      async (
        type: 'access_granted' | 'access_denied' | 'security_check',
        action: AccessAction,
        resourceId?: string
      ): Promise<void> => {
        if (!logEvents || !adminUser?.id) return;

        await logSecurityEvent({
          type,
          resourceType,
          resourceId,
          action,
          userId: adminUser.id,
          result: {
            authorized: type === 'access_granted',
            layers: [],
          },
          timestamp: new Date(),
        });
      },
      [adminUser?.id]
    );

    // Helper: Check permission
    const hasPermission = useCallback(
      (permission: string): boolean => {
        return authHasPermission(permission);
      },
      [authHasPermission]
    );

    // Helper: Check role level
    const checkRoleLevel = useCallback(
      (level: number): boolean => {
        return meetsRoleLevel(roles, level);
      },
      [roles]
    );

    // Show loading state
    if (authStatus === 'initializing' || authStatus === 'verifying_admin' || isLoading) {
      return <LoadingComponent />;
    }

    // Show access denied
    if (!isAuthorized) {
      return <AccessDeniedComponent reason={denialReason} />;
    }

    // Render wrapped component with security props
    const securityProps: SecurityLayerProps = {
      securityContext,
      canPerform,
      runCheck,
      logEvent,
      hasPermission,
      meetsRoleLevel: checkRoleLevel,
    };

    return <WrappedComponent {...(props as P)} {...securityProps} />;
  };

  // Set display name for debugging
  const wrappedName =
    displayName ||
    WrappedComponent.displayName ||
    WrappedComponent.name ||
    'Component';
  ComponentWithSecurityLayers.displayName = `withSecurityLayers(${wrappedName})`;

  return ComponentWithSecurityLayers;
}

// ============================================================================
// Security Badge Component
// ============================================================================

/**
 * Visual indicator showing current security status
 */
export const SecurityBadge: React.FC<{
  resourceType?: ResourceType;
  showDetails?: boolean;
}> = ({ resourceType, showDetails = false }) => {
  const { isAuthenticated, isAdminVerified, roles, permissions } = useAuth();
  const [context, setContext] = useState<SecurityContext | null>(null);

  useEffect(() => {
    if (isAuthenticated) {
      getSecurityContext().then(setContext);
    }
  }, [isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-full bg-destructive/10 text-destructive">
        <ShieldAlert className="h-3 w-3" />
        <span>Not Authenticated</span>
      </div>
    );
  }

  if (!isAdminVerified) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-full bg-yellow-500/10 text-yellow-600">
        <ShieldAlert className="h-3 w-3" />
        <span>Verifying...</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 text-xs rounded-full bg-green-500/10 text-green-600">
      <ShieldCheck className="h-3 w-3" />
      <span>Secured</span>
      {showDetails && context && (
        <span className="text-muted-foreground">
          ({roles.join(', ')} | {permissions.length} permissions)
        </span>
      )}
    </div>
  );
};

// ============================================================================
// Exports
// ============================================================================

export default withSecurityLayers;
