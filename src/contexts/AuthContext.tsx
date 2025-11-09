import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface AdminUser {
  id: string;
  email: string;
  username?: string;
  role?: string;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  adminUser: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  verifyAdminAccess: () => Promise<boolean>;
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

      // Set admin user data
      setAdminUser({
        id: data.id,
        email: data.email,
        username: data.user_metadata?.username,
        role: 'admin'
      });

      return true;
    } catch (error) {
      logger.error('Error verifying admin access:', error);
      setAdminUser(null);
      return false;
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
          logger.error('Error getting initial session:', error);
          setSession(null);
          setUser(null);
          setAdminUser(null);
        } else if (initialSession) {
          logger.debug('Session restored from storage');
          setSession(initialSession);
          setUser(initialSession.user);

          // Verify admin access if we have a session
          await verifyAdminAccess();
        } else {
          logger.debug('No session found in storage');
          setSession(null);
          setUser(null);
          setAdminUser(null);
        }
      } catch (error) {
        logger.error('Error initializing auth:', error);
        setSession(null);
        setUser(null);
        setAdminUser(null);
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
  }, [verifyAdminAccess]);

  /**
   * Listen for auth state changes
   * This handles sign-in, sign-out, token refresh, and cross-tab sync
   */
  useEffect(() => {
    if (!isInitialized) return;

    logger.debug('Setting up auth state change listener');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, currentSession: Session | null) => {
        logger.debug(`Auth state changed: ${event}`, {
          hasSession: !!currentSession,
          userId: currentSession?.user?.id
        });

        // Update session and user state
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        // Handle different auth events
        switch (event) {
          case 'SIGNED_IN':
            logger.info('User signed in');
            // Verify admin access for new sign-ins
            if (currentSession) {
              await verifyAdminAccess();
            }
            break;

          case 'SIGNED_OUT':
            logger.info('User signed out');
            setAdminUser(null);
            break;

          case 'TOKEN_REFRESHED':
            logger.debug('Token refreshed successfully');
            // Re-verify admin access after token refresh
            if (currentSession) {
              await verifyAdminAccess();
            }
            break;

          case 'USER_UPDATED':
            logger.debug('User data updated');
            break;

          default:
            logger.debug(`Unhandled auth event: ${event}`);
        }
      }
    );

    return () => {
      logger.debug('Cleaning up auth state change listener');
      subscription.unsubscribe();
    };
  }, [isInitialized, verifyAdminAccess]);

  /**
   * Sign in with email and password
   * Includes admin verification via edge function
   */
  const signIn = useCallback(async (email: string, password: string) => {
    try {
      setIsLoading(true);

      // First authenticate with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (authError || !authData.session) {
        return {
          success: false,
          error: authError?.message || 'Login failed'
        };
      }

      // Session and user will be set via onAuthStateChange listener
      // But we can also verify admin access immediately
      const { data, error: functionError } = await supabase.functions.invoke('admin-auth', {
        body: {
          action: 'login',
          email,
          password
        }
      });

      if (functionError || data?.error) {
        // If admin verification fails, sign out
        await supabase.auth.signOut();
        return {
          success: false,
          error: data?.error || functionError.message || 'Access denied'
        };
      }

      logger.info('Sign in successful');
      return { success: true };

    } catch (error) {
      logger.error('Sign in error:', error);
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
   */
  const signOut = useCallback(async () => {
    try {
      setIsLoading(true);

      // Call logout edge function for cleanup
      await supabase.functions.invoke('admin-auth', {
        body: { action: 'logout' }
      }).catch(err => {
        // Don't fail logout if edge function fails
        logger.warn('Logout edge function error:', err);
      });

      // Sign out from Supabase
      await supabase.auth.signOut();

      // Clear local state (will also be cleared by onAuthStateChange)
      setSession(null);
      setUser(null);
      setAdminUser(null);

      logger.info('Sign out successful');
    } catch (error) {
      logger.error('Sign out error:', error);
      // Force clear state even if sign out fails
      setSession(null);
      setUser(null);
      setAdminUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const value: AuthContextType = {
    session,
    user,
    adminUser,
    isLoading,
    isAuthenticated: !!session && !!user,
    isAdmin: !!adminUser,
    signIn,
    signOut,
    verifyAdminAccess
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
