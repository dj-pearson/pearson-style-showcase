import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Session, User, Provider } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// App role type matching database enum
export type AppRole = 'admin' | 'editor' | 'viewer';

// Auth status state machine - eliminates race conditions by having explicit states
export type AuthStatus =
  | 'initializing'      // App just loaded, checking for existing session
  | 'unauthenticated'   // No valid session
  | 'authenticated'     // Supabase session valid, admin verification pending
  | 'verifying_admin'   // Currently verifying admin access
  | 'admin_verified'    // Full admin access verified
  | 'error';            // Auth error occurred

interface AdminUser {
  id: string;
  email: string;
  username?: string;
  roles: AppRole[];
  permissions: string[];
}

interface AuthContextType {
  // Core state
  session: Session | null;
  user: User | null;
  adminUser: AdminUser | null;
  authStatus: AuthStatus;
  error: string | null;

  // Computed state
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdminVerified: boolean;
  isAdmin: boolean;
  isEditor: boolean;
  isViewer: boolean;
  roles: AppRole[];
  permissions: string[];

  // Actions
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signInWithProvider: (provider: Provider) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  verifyAdminAccess: () => Promise<boolean>;

  // Permission checks
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
  // Core state
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('initializing');
  const [error, setError] = useState<string | null>(null);

  // Refs to track current state without causing re-renders
  // These prevent stale closure issues in the auth listener
  const authStatusRef = useRef<AuthStatus>('initializing');
  const isProcessingRef = useRef(false);

  // Keep ref in sync with state
  useEffect(() => {
    authStatusRef.current = authStatus;
  }, [authStatus]);

  /**
   * Verify admin access by calling the admin-auth edge function
   */
  const verifyAdminAccess = useCallback(async (): Promise<boolean> => {
    logger.debug('Verifying admin access...');

    try {
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !currentSession) {
        logger.debug('No valid session found during admin verification', {
          hasSession: !!currentSession,
          error: sessionError?.message,
        });
        setAdminUser(null);
        return false;
      }

      logger.debug('Calling admin-auth me edge function...');

      // Add 10 second timeout to prevent infinite hang
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Admin verification timeout')), 10000);
      });

      const adminCheckPromise = supabase.functions.invoke('admin-auth', {
        body: { action: 'me' }
      });

      const { data, error: functionError } = await Promise.race([
        adminCheckPromise,
        timeoutPromise
      ]);

      logger.debug('admin-auth me response:', {
        hasData: !!data,
        error: functionError?.message || data?.error,
        raw: data,
      });

      if (functionError || data?.error) {
        logger.warn('Admin verification failed:', functionError?.message || data?.error);
        setAdminUser(null);
        return false;
      }

      const adminData: AdminUser = {
        id: data.id,
        email: data.email,
        username: data.username || data.email?.split('@')[0],
        roles: data.roles || ['admin'],
        permissions: data.permissions || []
      };

      setAdminUser(adminData);
      logger.debug('Admin verification successful:', adminData.email);
      return true;
    } catch (err) {
      logger.error('Error verifying admin access:', err);
      setAdminUser(null);
      return false;
    }
  }, []);

  /**
   * Clear all auth-related data from localStorage
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
   * Process a session - verify admin access and update state
   * Uses isProcessingRef to prevent concurrent processing
   */
  const processSession = useCallback(async (newSession: Session | null, source: string) => {
    // Prevent concurrent processing
    if (isProcessingRef.current) {
      logger.debug(`Skipping session processing from ${source} - already processing`);
      return;
    }

    logger.debug(`Processing session from ${source}:`, { hasSession: !!newSession });
    isProcessingRef.current = true;

    try {
      if (!newSession) {
        setSession(null);
        setUser(null);
        setAdminUser(null);
        setAuthStatus('unauthenticated');
        setError(null);
        return;
      }

      // Update session state
      setSession(newSession);
      setUser(newSession.user);
      setAuthStatus('verifying_admin');

      // Verify admin access with timeout (30 seconds for OAuth flows)
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Admin verification timeout')), 30000);
      });

      const adminCheckPromise = supabase.functions.invoke('admin-auth', {
        body: { action: 'me' }
      });

      const { data, error: functionError } = await Promise.race([
        adminCheckPromise,
        timeoutPromise
      ]);

      if (functionError || data?.error) {
        logger.warn('Admin verification failed:', functionError?.message || data?.error);
        setAdminUser(null);
        setAuthStatus('authenticated');
        return;
      }

      const adminData: AdminUser = {
        id: data.id,
        email: data.email,
        username: data.username || data.email?.split('@')[0],
        roles: data.roles || ['admin'],
        permissions: data.permissions || []
      };

      setAdminUser(adminData);
      setAuthStatus('admin_verified');
      logger.info(`Admin verified from ${source}:`, adminData.email);
    } catch (err) {
      logger.error('Error during admin verification:', err);
      setAdminUser(null);
      setAuthStatus('authenticated');
    } finally {
      isProcessingRef.current = false;
    }
  }, []);

  /**
   * Initialize auth on mount and set up listener
   * Combined into single effect to prevent race conditions
   */
  useEffect(() => {
    let mounted = true;

    // Set up auth state change listener FIRST
    logger.debug('Setting up auth state change listener');
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;
        
        const currentStatus = authStatusRef.current;

        logger.debug(`Auth state changed: ${event}`, {
          hasSession: !!currentSession,
          currentStatus
        });

        switch (event) {
          case 'INITIAL_SESSION':
            // This fires on page load/reload with restored session
            logger.debug('Initial session event received');
            if (currentSession && !isProcessingRef.current) {
              await processSession(currentSession, 'INITIAL_SESSION event');
            } else if (!currentSession) {
              setAuthStatus('unauthenticated');
            }
            break;

          case 'SIGNED_IN':
            // Skip if we're already processing, verifying, or verified
            if (isProcessingRef.current ||
                currentStatus === 'verifying_admin' ||
                currentStatus === 'admin_verified') {
              logger.debug('Skipping SIGNED_IN - already handling auth');
              return;
            }
            await processSession(currentSession, 'SIGNED_IN event');
            break;

          case 'SIGNED_OUT':
            logger.info('User signed out');
            setSession(null);
            setUser(null);
            setAdminUser(null);
            setAuthStatus('unauthenticated');
            setError(null);
            break;

          case 'TOKEN_REFRESHED':
            logger.debug('Token refreshed');
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            break;

          case 'USER_UPDATED':
            logger.debug('User data updated');
            setSession(currentSession);
            setUser(currentSession?.user ?? null);
            break;

          default:
            logger.debug(`Unhandled auth event: ${event}`);
        }
      }
    );

    // CRITICAL: Also manually check for existing session as fallback
    // INITIAL_SESSION event may not always fire reliably
    const checkExistingSession = async () => {
      // Small delay to let INITIAL_SESSION fire first if it's going to
      await new Promise(resolve => setTimeout(resolve, 100));
      
      if (!mounted) return;
      
      // Only check if we're still initializing (INITIAL_SESSION didn't fire)
      if (authStatusRef.current === 'initializing' && !isProcessingRef.current) {
        logger.debug('Manually checking for existing session (fallback)');
        const { data: { session: existingSession }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          logger.error('Error getting session:', error);
          setAuthStatus('unauthenticated');
          return;
        }
        
        if (existingSession && !isProcessingRef.current) {
          logger.debug('Found existing session via manual check');
          await processSession(existingSession, 'manual getSession fallback');
        } else if (!existingSession && authStatusRef.current === 'initializing') {
          logger.debug('No existing session found');
          setAuthStatus('unauthenticated');
        }
      }
    };

    checkExistingSession();

    return () => {
      mounted = false;
      logger.debug('Cleaning up auth state change listener');
      subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run once on mount

  /**
   * Sign in with email and password
   */
  const signIn = useCallback(async (email: string, password: string) => {
    logger.debug('Sign in attempt:', email);
    setError(null);
    isProcessingRef.current = true;
    setAuthStatus('verifying_admin');

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError || !authData.session) {
        logger.warn('Supabase signInWithPassword failed:', authError?.message);
        isProcessingRef.current = false;
        setAuthStatus('unauthenticated');
        const errorMsg = authError?.message || 'Login failed';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      logger.debug('Supabase signInWithPassword succeeded, verifying admin access via admin-auth me');
      setSession(authData.session);
      setUser(authData.user);

      const adminVerified = await verifyAdminAccess();

      if (!adminVerified) {
        logger.warn('Admin verification failed after sign-in');
        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setAdminUser(null);
        setAuthStatus('unauthenticated');
        isProcessingRef.current = false;
        const errorMsg = 'Access denied';
        setError(errorMsg);
        return { success: false, error: errorMsg };
      }

      setAuthStatus('admin_verified');
      isProcessingRef.current = false;
      logger.info('Sign in successful and admin verified:', email);

      return { success: true };
    } catch (err) {
      logger.error('Sign in error:', err);
      isProcessingRef.current = false;
      setAuthStatus('unauthenticated');
      const errorMsg = 'Network error. Please try again.';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, [verifyAdminAccess]);

  /**
   * Sign in with OAuth provider (Google, Apple, etc.)
   */
  const signInWithProvider = useCallback(async (provider: Provider) => {
    logger.debug('OAuth sign in attempt:', provider);
    setError(null);

    try {
      const redirectTo = `${window.location.origin}/auth/callback`;

      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          queryParams: provider === 'google' ? {
            access_type: 'offline',
            prompt: 'consent',
          } : undefined
        }
      });

      if (oauthError) {
        logger.error('OAuth error:', oauthError);
        setError(oauthError.message);
        return { success: false, error: oauthError.message };
      }

      logger.debug('OAuth redirect initiated:', data);
      return { success: true };
    } catch (err) {
      logger.error('OAuth sign in error:', err);
      const errorMsg = 'Failed to initiate OAuth sign in';
      setError(errorMsg);
      return { success: false, error: errorMsg };
    }
  }, []);

  /**
   * Sign out
   */
  const signOut = useCallback(async () => {
    logger.info('Sign out requested');

    // Immediately update UI state
    setAdminUser(null);
    setAuthStatus('unauthenticated');
    setError(null);

    try {
      supabase.functions.invoke('admin-auth', {
        body: { action: 'logout' }
      }).catch(err => {
        logger.debug('Logout edge function error (non-critical):', err);
      });

      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        logger.warn('Supabase signOut error:', signOutError);
      }

      setSession(null);
      setUser(null);
      clearStoredAuthData();

      logger.info('Sign out completed');
    } catch (err) {
      logger.error('Sign out error:', err);
      setSession(null);
      setUser(null);
      clearStoredAuthData();
    }
  }, [clearStoredAuthData]);

  // Permission check functions
  const hasRole = useCallback((role: AppRole): boolean => {
    return adminUser?.roles?.includes(role) ?? false;
  }, [adminUser]);

  const hasPermission = useCallback((permission: string): boolean => {
    return adminUser?.permissions?.includes(permission) ?? false;
  }, [adminUser]);

  const hasAnyPermission = useCallback((permissions: string[]): boolean => {
    if (!adminUser?.permissions) return false;
    return permissions.some(p => adminUser.permissions.includes(p));
  }, [adminUser]);

  const hasAllPermissions = useCallback((permissions: string[]): boolean => {
    if (!adminUser?.permissions) return false;
    return permissions.every(p => adminUser.permissions.includes(p));
  }, [adminUser]);

  // Computed values - memoized for performance
  const value = useMemo<AuthContextType>(() => ({
    session,
    user,
    adminUser,
    authStatus,
    error,

    isLoading: authStatus === 'initializing' || authStatus === 'verifying_admin',
    isAuthenticated: !!session && !!user,
    isAdminVerified: authStatus === 'admin_verified' && !!adminUser,
    isAdmin: adminUser?.roles?.includes('admin') ?? false,
    isEditor: adminUser?.roles?.includes('editor') ?? false,
    isViewer: adminUser?.roles?.includes('viewer') ?? false,
    roles: adminUser?.roles ?? [],
    permissions: adminUser?.permissions ?? [],

    signIn,
    signInWithProvider,
    signOut,
    verifyAdminAccess,

    hasRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions
  }), [
    session,
    user,
    adminUser,
    authStatus,
    error,
    signIn,
    signInWithProvider,
    signOut,
    verifyAdminAccess,
    hasRole,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
