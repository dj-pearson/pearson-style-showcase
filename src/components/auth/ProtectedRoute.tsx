import React, { useEffect, useState, useRef } from 'react';
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
 * - Uses cached adminUser when available (no redundant network calls)
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
    adminUser,
    verifyAdminAccess,
    hasRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions
  } = useAuth();
  const location = useLocation();
  const [isVerifying, setIsVerifying] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  // Track if we've done our initial access check - prevents rendering Navigate before useEffect runs
  const [hasChecked, setHasChecked] = useState(false);
  const hasVerified = useRef(false);

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
   * Check access using cached adminUser or verify if needed
   */
  useEffect(() => {
    let mounted = true;

    const checkAccess = async () => {
      const needsVerification = requireAdmin || requireRole || requirePermission;

      // If no special access required, just allow authenticated users
      if (!needsVerification) {
        if (isAuthenticated) {
          setHasAccess(true);
        }
        setIsVerifying(false);
        setHasChecked(true);
        return;
      }

      // Wait for initial auth loading to complete
      if (isLoading) {
        return;
      }

      // Not authenticated - will redirect below
      if (!isAuthenticated) {
        setHasAccess(false);
        setIsVerifying(false);
        setHasChecked(true);
        return;
      }

      // If we already have adminUser from AuthContext, use it directly
      // This avoids redundant network calls when navigating between protected routes
      if (adminUser) {
        logger.debug('Using cached adminUser for access check');

        // Check admin requirement
        if (requireAdmin && !hasRole('admin')) {
          logger.warn('Admin role required but not present');
          setHasAccess(false);
          setIsVerifying(false);
          setHasChecked(true);
          return;
        }

        // Check role requirement
        if (!checkRoleAccess()) {
          logger.warn('Required role not present');
          setHasAccess(false);
          setIsVerifying(false);
          setHasChecked(true);
          return;
        }

        // Check permission requirement
        if (!checkPermissionAccess()) {
          logger.warn('Required permission not present');
          setHasAccess(false);
          setIsVerifying(false);
          setHasChecked(true);
          return;
        }

        logger.debug('Access verified using cached adminUser');
        setHasAccess(true);
        setIsVerifying(false);
        setHasChecked(true);
        hasVerified.current = true;
        return;
      }

      // No adminUser yet - need to verify (happens when session was restored from storage)
      // Only verify once per mount to prevent loops
      if (hasVerified.current) {
        setHasAccess(false);
        setIsVerifying(false);
        setHasChecked(true);
        return;
      }

      setIsVerifying(true);
      try {
        logger.debug('Verifying admin access (no cached adminUser)');
        const hasAdminAccess = await verifyAdminAccess();

        if (!mounted) return;

        hasVerified.current = true;

        if (!hasAdminAccess) {
          logger.warn('Admin verification failed');
          setHasAccess(false);
          setIsVerifying(false);
          setHasChecked(true);
          return;
        }

        // After verification, hasRole/hasPermission will work because adminUser is now set
        // Check admin requirement
        if (requireAdmin && !hasRole('admin')) {
          logger.warn('Admin role required but not present');
          setHasAccess(false);
          setIsVerifying(false);
          setHasChecked(true);
          return;
        }

        // Check role requirement (will re-check with fresh adminUser)
        if (requireRole) {
          const roleAccess = Array.isArray(requireRole)
            ? requireRole.some(role => hasRole(role))
            : hasRole(requireRole);
          if (!roleAccess) {
            logger.warn('Required role not present');
            setHasAccess(false);
            setIsVerifying(false);
            setHasChecked(true);
            return;
          }
        }

        // Check permission requirement (will re-check with fresh adminUser)
        if (requirePermission) {
          const permAccess = Array.isArray(requirePermission)
            ? (requireAllPermissions ? hasAllPermissions(requirePermission) : hasAnyPermission(requirePermission))
            : hasPermission(requirePermission);
          if (!permAccess) {
            logger.warn('Required permission not present');
            setHasAccess(false);
            setIsVerifying(false);
            setHasChecked(true);
            return;
          }
        }

        logger.debug('Access verified successfully');
        setHasAccess(true);
        setIsVerifying(false);
        setHasChecked(true);
      } catch (error) {
        logger.error('Error verifying access:', error);
        if (mounted) {
          hasVerified.current = true;
          setHasAccess(false);
          setIsVerifying(false);
          setHasChecked(true);
        }
      }
    };

    checkAccess();

    return () => {
      mounted = false;
    };
  // Minimal dependencies - only re-run when auth state changes meaningfully
  }, [isLoading, isAuthenticated, adminUser, requireAdmin, requireRole, requirePermission, requireAllPermissions]);

  // Show loading state while auth is initializing, verifying, or before initial check completes
  // The !hasChecked check prevents rendering Navigate before useEffect has a chance to run
  if (isLoading || isVerifying || !hasChecked) {
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
