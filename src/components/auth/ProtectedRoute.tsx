import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  redirectTo?: string;
}

/**
 * ProtectedRoute component
 *
 * Wraps routes that require authentication and/or admin access.
 * Features:
 * - Waits for auth initialization before rendering
 * - Shows loading state during auth check
 * - Stores return URL for post-login redirect
 * - Supports admin-only routes
 * - Silent auth verification (no premature redirects)
 */
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requireAdmin = false,
  redirectTo = '/admin/login'
}) => {
  const { isLoading, isAuthenticated, verifyAdminAccess } = useAuth();
  const location = useLocation();
  const [isVerifying, setIsVerifying] = useState(requireAdmin);
  const [hasAccess, setHasAccess] = useState(false);

  /**
   * For admin routes, verify access via edge function
   * This ensures the user is not only authenticated but also authorized
   */
  useEffect(() => {
    let mounted = true;

    const checkAccess = async () => {
      if (!requireAdmin) {
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

      // Verify admin access
      setIsVerifying(true);
      try {
        logger.debug('Verifying admin access for protected route');
        const hasAdminAccess = await verifyAdminAccess();

        if (mounted) {
          setHasAccess(hasAdminAccess);
          setIsVerifying(false);

          if (hasAdminAccess) {
            logger.debug('Admin access verified');
          } else {
            logger.warn('Admin access denied');
          }
        }
      } catch (error) {
        logger.error('Error verifying admin access:', error);
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
  }, [isLoading, isAuthenticated, requireAdmin, verifyAdminAccess]);

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

  // Authenticated but doesn't have admin access (if required)
  if (requireAdmin && !hasAccess) {
    logger.warn('User lacks admin access, redirecting to login');

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
