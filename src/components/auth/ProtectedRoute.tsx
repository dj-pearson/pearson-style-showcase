import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  requireRole?: AppRole | AppRole[];
  requirePermission?: string | string[];
  requireAllPermissions?: boolean;
  redirectTo?: string;
  fallback?: React.ReactNode;
}

/**
 * ProtectedRoute component
 *
 * Wraps routes that require authentication and/or specific access.
 * Features:
 * - Waits for auth initialization before rendering
 * - Shows loading state during auth check
 * - Stores return URL for post-login redirect
 * - Supports admin-only routes
 * - Supports role-based access control
 * - Supports permission-based access control
 * - Silent auth verification (no premature redirects)
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  requireRole,
  requirePermission,
  requireAllPermissions = false,
  redirectTo = '/admin/login',
  fallback
}) => {
  const {
    isLoading,
    isAuthenticated,
    verifyAdminAccess,
    hasRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions
  } = useAuth();
  const location = useLocation();
  const [isVerifying, setIsVerifying] = useState(requireAdmin || !!requireRole || !!requirePermission);
  const [hasAccess, setHasAccess] = useState(false);

  /**
   * Check if user has the required role(s)
   */
  const checkRoleAccess = (): boolean => {
    if (!requireRole) return true;

    if (Array.isArray(requireRole)) {
      // User must have at least one of the roles
      return requireRole.some(role => hasRole(role));
    }
    return hasRole(requireRole);
  };

  /**
   * Check if user has the required permission(s)
   */
  const checkPermissionAccess = (): boolean => {
    if (!requirePermission) return true;

    if (Array.isArray(requirePermission)) {
      // Check based on requireAllPermissions flag
      return requireAllPermissions
        ? hasAllPermissions(requirePermission)
        : hasAnyPermission(requirePermission);
    }
    return hasPermission(requirePermission);
  };

  /**
   * Verify access based on all requirements
   */
  useEffect(() => {
    let mounted = true;

    const checkAccess = async () => {
      const needsVerification = requireAdmin || requireRole || requirePermission;

      if (!needsVerification) {
        setHasAccess(true);
        setIsVerifying(false);
        return;
      }

      if (isLoading) {
        // Wait for initial auth loading to complete
        return;
      }

      if (!isAuthenticated) {
        // Not authenticated, will redirect below
        setHasAccess(false);
        setIsVerifying(false);
        return;
      }

      // Verify admin access if required
      setIsVerifying(true);
      try {
        logger.debug('Verifying access for protected route');
        const hasAdminAccess = await verifyAdminAccess();

        if (!mounted) return;

        if (!hasAdminAccess) {
          logger.warn('Admin verification failed');
          setHasAccess(false);
          setIsVerifying(false);
          return;
        }

        // Check admin requirement
        if (requireAdmin && !hasRole('admin')) {
          logger.warn('Admin role required but not present');
          setHasAccess(false);
          setIsVerifying(false);
          return;
        }

        // Check role requirement
        if (!checkRoleAccess()) {
          logger.warn('Required role not present');
          setHasAccess(false);
          setIsVerifying(false);
          return;
        }

        // Check permission requirement
        if (!checkPermissionAccess()) {
          logger.warn('Required permission not present');
          setHasAccess(false);
          setIsVerifying(false);
          return;
        }

        logger.debug('Access verified successfully');
        setHasAccess(true);
        setIsVerifying(false);
      } catch (error) {
        logger.error('Error verifying access:', error);
        if (mounted) {
          setHasAccess(false);
          setIsVerifying(false);
        }
      }
    };

    checkAccess();

    return () => {
      mounted = false;
    };
  }, [isLoading, isAuthenticated, requireAdmin, requireRole, requirePermission, verifyAdminAccess, hasRole, hasPermission, hasAnyPermission, hasAllPermissions]);

  // Show loading state while auth is initializing or verifying
  if (isLoading || isVerifying) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-muted-foreground">
            {isLoading ? 'Loading...' : 'Verifying access...'}
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login with return URL
  if (!isAuthenticated) {
    logger.debug('Not authenticated, redirecting to login');

    // Store the current location for post-login redirect
    const returnUrl = `${location.pathname}${location.search}${location.hash}`;
    sessionStorage.setItem('auth_return_url', returnUrl);

    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Authenticated but doesn't have required access
  if (!hasAccess) {
    logger.warn('User lacks required access');

    // If a fallback is provided, show it instead of redirecting
    if (fallback) {
      return <>{fallback}</>;
    }

    // Clear any stored admin state and redirect
    sessionStorage.removeItem('auth_return_url');

    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Authenticated and authorized - render the protected content
  return <>{children}</>;
};

/**
 * Hook to check if admin verification is needed for current route
 */
export const useRequiresAdmin = () => {
  const location = useLocation();
  return location.pathname.startsWith('/admin/');
};
