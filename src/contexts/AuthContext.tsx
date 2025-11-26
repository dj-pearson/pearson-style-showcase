import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// App role type matching database enum
export type AppRole = 'admin' | 'editor' | 'viewer';

interface AdminUser {
  id: string;
  email: string;
  username?: string;
  roles: AppRole[];
  permissions: string[];
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  adminUser: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  isViewer: boolean;
  roles: AppRole[];
  permissions: string[];
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  verifyAdminAccess: () => Promise<boolean>;
  hasRole: (role: AppRole) => boolean;
  hasPermission: (permission: string) => boolean;
  hasAnyPermission: (permissions: string[]) => boolean;
  hasAllPermissions: (permissions: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isInitialized, setIsInitialized] = useState(false);

  // Track if we're in the middle of a sign-in to prevent duplicate verifications
  const isSigningIn = useRef(false);
  // Track if sign-out was explicitly requested
  const isSigningOut = useRef(false);

  /**
   * Verify admin access by calling the admin-auth edge function
   * This checks both the session validity and admin whitelist
   */
  const verifyAdminAccess = useCallback(async (): Promise<boolean> => {
    try {
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !currentSession) {
        logger.debug('No valid session found during admin verification');
        setAdminUser(null);
        return false;
      }

      // Verify admin access via edge function
      const { data, error: functionError } = await supabase.functions.invoke('admin-auth', {
        body: { action: 'me' }
      });

      if (functionError || data?.error) {
        logger.warn('Admin verification failed:', functionError?.message || data?.error);
        setAdminUser(null);
        return false;
      }

      // Set admin user data with roles and permissions
      setAdminUser({
        id: data.id,
        email: data.email,
        username: data.username || data.email?.split('@')[0],
        roles: data.roles || ['admin'],
        permissions: data.permissions || []
      });

      return true;
    } catch (error) {
      logger.error('Error verifying admin access:', error);
      setAdminUser(null);
      return false;
    }
  }, []);

  /**
   * Check if user has a specific role
   */
  const hasRole = useCallback((role: AppRole): boolean => {
    return adminUser?.roles?.includes(role) ?? false;
  }, [adminUser]);

  /**
   * Check if user has a specific permission
   */
  const hasPermission = useCallback((permission: string): boolean => {
    return adminUser?.permissions?.includes(permission) ?? false;
  }, [adminUser]);

  /**
   * Check if user has any of the specified permissions
   */
  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    if (!adminUser?.permissions) return false;
    return permissions.some(p => adminUser.permissions.includes(p));
  }, [adminUser]);

  /**
   * Check if user has all of the specified permissions
   */
  const hasAllPermissions = useCallback((permissions: string[]): boolean => {
    if (!adminUser?.permissions) return false;
    return permissions.every(p => adminUser.permissions.includes(p));
  }, [adminUser]);

  /**
   * Clear all auth-related data from localStorage
   * This ensures stale tokens don't cause issues
   */
  const clearStoredAuthData = useCallback(() => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('sb-') || key.includes('supabase')) {
          localStorage.removeItem(key);
        }
      });
      logger.debug('Cleared stored auth data');
    } catch (storageError) {
      logger.debug('Could not clear localStorage:', storageError);
    }
  }, []);

  /**
   * Initialize session on mount
   * This waits for Supabase to restore the session from localStorage
   */
  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        logger.debug('Initializing auth session...');

        // Wait for Supabase to restore session from localStorage
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          // Check for specific refresh token errors
          const errorMessage = error.message?.toLowerCase() || '';
          const isRefreshTokenError = 
            errorMessage.includes('refresh token') || 
            errorMessage.includes('invalid token') ||
            errorMessage.includes('session not found') ||
            error.name === 'AuthApiError';
          
          if (isRefreshTokenError) {
            logger.warn('Invalid or expired refresh token, clearing stale session');
            // Clear stale auth data to prevent stuck states
            clearStoredAuthData();
          } else {
            logger.error('Error getting initial session:', error);
          }
          
          setSession(null);
          setUser(null);
          setAdminUser(null);
        } else if (initialSession) {
          logger.debug('Session restored from storage');
          setSession(initialSession);
          setUser(initialSession.user);

          // Verify admin access if we have a restored session
          // Use stable reference via direct call (not from dependency)
          try {
            const { data, error: functionError } = await supabase.functions.invoke('admin-auth', {
              body: { action: 'me' }
            });

            if (!mounted) return;

            if (!functionError && !data?.error) {
              setAdminUser({
                id: data.id,
                email: data.email,
                username: data.username || data.email?.split('@')[0],
                roles: data.roles || ['admin'],
                permissions: data.permissions || []
              });
            } else {
              // Admin verification failed - user is authenticated but might not be admin
              // This is normal for non-admin users, just set adminUser to null
              logger.debug('Admin verification failed on init (user may not be admin):', functionError?.message || data?.error);
              setAdminUser(null);
              // Note: Don't sign out here - user is still authenticated, just not admin
            }
          } catch (verifyError) {
            logger.error('Error during admin verification:', verifyError);
            if (mounted) {
              setAdminUser(null);
            }
          }
        } else {
          logger.debug('No session found in storage');
          setSession(null);
          setUser(null);
          setAdminUser(null);
        }
      } catch (error) {
        logger.error('Error initializing auth:', error);
        if (mounted) {
          // Check if this is a refresh token error
          const errorMessage = (error as Error)?.message?.toLowerCase() || '';
          if (errorMessage.includes('refresh token') || errorMessage.includes('invalid')) {
            logger.warn('Clearing stale auth data due to initialization error');
            clearStoredAuthData();
          }
          setSession(null);
          setUser(null);
          setAdminUser(null);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
          setIsInitialized(true);
          logger.debug('Auth initialization complete');
        }
      }
    };

    initializeAuth();

    return () => {
      mounted = false;
    };
  }, [clearStoredAuthData]); // Include clearStoredAuthData dependency

  /**
   * Listen for auth state changes
   * This handles sign-out, token refresh, and cross-tab sync
   * Note: SIGNED_IN during signIn() is handled by signIn itself to avoid race conditions
   */
  useEffect(() => {
    if (!isInitialized) return;

    logger.debug('Setting up auth state change listener');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event: AuthChangeEvent, currentSession: Session | null) => {
        logger.debug(`Auth state changed: ${event}`, {
          hasSession: !!currentSession,
          userId: currentSession?.user?.id,
          isSigningIn: isSigningIn.current,
          isSigningOut: isSigningOut.current
        });

        // Handle different auth events
        switch (event) {
          case 'SIGNED_IN':
            // Update session state
            setSession(currentSession);
            setUser(currentSession?.user ?? null);

            // Skip verification if we're in the middle of signIn() - it handles this itself
            if (isSigningIn.current) {
              logger.debug('Skipping listener verification - signIn() is handling it');
              return;
            }

            // This might be from OAuth, magic link, or another tab signing in
            logger.info('User signed in (external source)');
            if (currentSession) {
              // Verify admin access for external sign-ins
              supabase.functions.invoke('admin-auth', {
                body: { action: 'me' }
              }).then(({ data, error: functionError }) => {
                if (!functionError && !data?.error) {
                  setAdminUser({
                    id: data.id,
                    email: data.email,
                    username: data.username || data.email?.split('@')[0],
                    roles: data.roles || ['admin'],
                    permissions: data.permissions || []
                  });
                } else {
                  logger.warn('Admin verification failed for external sign-in');
                  setAdminUser(null);
                }
              }).catch(err => {
                logger.error('Error verifying admin after external sign-in:', err);
                setAdminUser(null);
              });
            }
            break;

          case 'SIGNED_OUT':
            logger.info('User signed out');
            // Always clear all state on sign out
            setSession(null);
            setUser(null);
            setAdminUser(null);
            isSigningOut.current = false;
            break;

          case 'TOKEN_REFRESHED':
            logger.debug('Token refreshed successfully');
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            // Don't re-verify on token refresh - we already have adminUser
            break;

          case 'TOKEN_REFRESH_FAILED':
            // Handle token refresh failures - this happens when refresh token is invalid/expired
            logger.warn('Token refresh failed - session is invalid');
            setSession(null);
            setUser(null);
            setAdminUser(null);
            // Clear any stale auth data from localStorage
            try {
              const keys = Object.keys(localStorage);
              keys.forEach(key => {
                if (key.startsWith('sb-') || key.includes('supabase')) {
                  localStorage.removeItem(key);
                }
              });
            } catch (storageError) {
              logger.debug('Could not clear localStorage:', storageError);
            }
            break;

          case 'USER_UPDATED':
            logger.debug('User data updated');
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            break;

          default:
            logger.debug(`Unhandled auth event: ${event}`);
            // Update session state for any event
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
        }
      }
    );

    return () => {
      logger.debug('Cleaning up auth state change listener');
      subscription.unsubscribe();
    };
  }, [isInitialized]);

  /**
   * Sign in with email and password
   * Includes admin verification via edge function
   */
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);
      isSigningIn.current = true;

      // First authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError || !authData.session) {
        isSigningIn.current = false;
        return {
          success: false,
          error: authError?.message || 'Login failed'
        };
      }

      // Update session state immediately
      setSession(authData.session);
      setUser(authData.user);

      // Verify admin access via edge function
      const { data, error: functionError } = await supabase.functions.invoke('admin-auth', {
        body: {
          action: 'login',
          email,
          password
        }
      });

      if (functionError || data?.error) {
        // If admin verification fails, sign out
        isSigningIn.current = false;
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setAdminUser(null);
        return {
          success: false,
          error: data?.error || functionError?.message || 'Access denied'
        };
      }

      // Set admin user data from login response
      setAdminUser({
        id: data.user?.id || authData.user.id,
        email: data.user?.email || email,
        username: data.user?.username || email.split('@')[0],
        roles: data.user?.roles || ['admin'],
        permissions: data.user?.permissions || []
      });

      isSigningIn.current = false;
      logger.info('Sign in successful');
      return { success: true };

    } catch (error) {
      logger.error('Sign in error:', error);
      isSigningIn.current = false;
      return {
        success: false,
        error: 'Network error. Please try again.'
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Sign out and clear all auth state
   * This is designed to ALWAYS work, even if network fails
   */
  const signOut = useCallback(async () => {
    logger.info('Sign out requested');
    isSigningOut.current = true;

    // Immediately clear UI state - don't wait for anything
    setAdminUser(null);

    try {
      // Try to call logout edge function for cleanup (fire and forget)
      supabase.functions.invoke('admin-auth', {
        body: { action: 'logout' }
      }).catch(err => {
        logger.debug('Logout edge function error (non-critical):', err);
      });

      // Sign out from Supabase - this triggers onAuthStateChange SIGNED_OUT
      const { error } = await supabase.auth.signOut();

      if (error) {
        logger.warn('Supabase signOut error:', error);
        // Force clear state manually since listener might not fire
        setSession(null);
        setUser(null);
      }

      // Clear any lingering localStorage auth data
      clearStoredAuthData();

      logger.info('Sign out completed');
    } catch (error) {
      logger.error('Sign out error:', error);
      // Force clear state even if sign out fails
      setSession(null);
      setUser(null);
      setAdminUser(null);
    } finally {
      isSigningOut.current = false;
    }
  }, [clearStoredAuthData]);

  const value: AuthContextType = {
    session,
    user,
    adminUser,
    isLoading,
    isAuthenticated: !!session && !!user,
    isAdmin: adminUser?.roles?.includes('admin') ?? false,
    isEditor: adminUser?.roles?.includes('editor') ?? false,
    isViewer: adminUser?.roles?.includes('viewer') ?? false,
    roles: adminUser?.roles ?? [],
    permissions: adminUser?.permissions ?? [],
    signIn,
    signOut,
    verifyAdminAccess,
    hasRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
