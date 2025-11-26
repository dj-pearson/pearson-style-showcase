import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth, AppRole } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { Loader2 } from 'lucide-react';

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
 * Simplified route protection using the auth state machine.
 * The AuthContext handles all the complex verification logic,
 * so this component just needs to check the current state.
 *
 * Features:
 * - Waits for auth initialization before rendering
 * - Shows loading state during auth check
 * - Stores return URL for post-login redirect
 * - Supports admin-only routes
 * - Supports role-based access control
 * - Supports permission-based access control
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
    authStatus,
    isAuthenticated,
    isAdminVerified,
    adminUser,
    hasRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions
  } = useAuth();
  const location = useLocation();

  // Still initializing or verifying - show loading
  if (authStatus === 'initializing' || authStatus === 'verifying_admin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            {authStatus === 'initializing' ? 'Loading...' : 'Verifying access...'}
          </p>
        </div>
      </div>
    );
  }

  // Not authenticated - redirect to login
  if (!isAuthenticated) {
    logger.debug('ProtectedRoute: Not authenticated, redirecting to login');

    // Store the current location for post-login redirect
    const returnUrl = `${location.pathname}${location.search}${location.hash}`;
    sessionStorage.setItem('auth_return_url', returnUrl);

    return <Navigate to={redirectTo} state={{ from: location }} replace />;
  }

  // Check if admin verification is required
  const needsAdminAccess = requireAdmin || requireRole || requirePermission;

  if (needsAdminAccess) {
    // Need admin but not verified
    if (!isAdminVerified || !adminUser) {
      logger.warn('ProtectedRoute: Admin access required but not verified');

      if (fallback) {
        return <>{fallback}</>;
      }

      // Store return URL and redirect
      const returnUrl = `${location.pathname}${location.search}${location.hash}`;
      sessionStorage.setItem('auth_return_url', returnUrl);

      return <Navigate to={redirectTo} state={{ from: location }} replace />;
    }

    // Admin role is validated server-side via the admin-auth edge function
    // Successful admin verification (isAdminVerified) is sufficient for requireAdmin routes.

    // Check role requirement
    if (requireRole) {
      const hasRequiredRole = Array.isArray(requireRole)
        ? requireRole.some(role => hasRole(role))
        : hasRole(requireRole);

      if (!hasRequiredRole) {
        logger.warn('ProtectedRoute: Required role not present');

        if (fallback) {
          return <>{fallback}</>;
        }

        return <Navigate to={redirectTo} state={{ from: location }} replace />;
      }
    }

    // Check permission requirement
    if (requirePermission) {
      const hasRequiredPermission = Array.isArray(requirePermission)
        ? (requireAllPermissions
            ? hasAllPermissions(requirePermission)
            : hasAnyPermission(requirePermission))
        : hasPermission(requirePermission);

      if (!hasRequiredPermission) {
        logger.warn('ProtectedRoute: Required permission not present');

        if (fallback) {
          return <>{fallback}</>;
        }

        return <Navigate to={redirectTo} state={{ from: location }} replace />;
      }
    }
  }

  // All checks passed - render the protected content
  return <>{children}</>;
};

/**
 * Hook to check if current route requires admin access
 */
export const useRequiresAdmin = () => {
  const location = useLocation();
  return location.pathname.startsWith('/admin/');
};
