import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { verifyOAuthState } from '@/lib/oauth-state';

/**
 * Validate that a redirect URL is a safe relative path.
 * Blocks absolute URLs, protocol-relative URLs, and javascript: schemes.
 */
function isValidRedirectUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  // Must start with a single slash (not //) and not contain protocol schemes
  return trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes(':');
}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * AuthCallback component
 *
 * Handles OAuth redirect callbacks from Google, Apple, etc.
 * Supports two flows:
 *
 * 1. OAuth Proxy Flow (primary):
 *    - oauth-proxy edge function redirects here with ?token=xxx&type=magiclink
 *    - We verify the OTP to create a Supabase session
 *    - AuthContext picks up the SIGNED_IN event and verifies admin access
 *
 * 2. Legacy PKCE Flow (fallback):
 *    - Supabase's built-in OAuth redirects here with tokens in URL hash
 *    - Supabase client auto-detects and processes tokens (detectSessionInUrl: true)
 *    - AuthContext picks up the SIGNED_IN event and verifies admin access
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { authStatus, isAdminVerified, error: authError } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasRedirected, setHasRedirected] = useState(false);
  const tokenProcessedRef = useRef(false);
  const stateVerifiedRef = useRef(false);

  // Step 1: Process tokens on mount (OAuth proxy magic link or PKCE code)
  useEffect(() => {
    if (tokenProcessedRef.current) return;
    tokenProcessedRef.current = true;

    const processTokens = async () => {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.substring(1));

        // Check for errors from OAuth provider or proxy
        const urlError = urlParams.get('error') || hashParams.get('error');
        const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');

        if (urlError) {
          logger.error('OAuth error from URL:', urlError, errorDescription);
          setStatus('error');
          setErrorMessage(errorDescription || urlError || 'Authentication failed');
          return;
        }

        // Flow 1: OAuth Proxy - magic link token from oauth-proxy edge function
        const token = searchParams.get('token');
        const type = searchParams.get('type');
        const rawRedirectTo = searchParams.get('redirect_to') || '/admin/dashboard';
        const redirectTo = isValidRedirectUrl(rawRedirectTo) ? rawRedirectTo : '/admin/dashboard';

        if (token && type) {
          logger.debug('Processing OAuth proxy magic link token');

          // Store validated redirect destination
          sessionStorage.setItem('auth_return_url', redirectTo);

          const { data, error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type as 'magiclink',
          });

          if (verifyError) {
            logger.error('Magic link verification failed:', verifyError);
            setStatus('error');
            setErrorMessage(verifyError.message || 'Failed to verify authentication token.');
            return;
          }

          if (data.session) {
            logger.debug('OAuth proxy magic link verified, session created. Waiting for admin verification...');
            // Session is now active - AuthContext will pick up the SIGNED_IN event
            // and trigger admin verification. We wait for authStatus changes below.
            return;
          }

          // No session returned despite no error - unexpected
          logger.error('OAuth proxy: No session returned after OTP verification');
          setStatus('error');
          setErrorMessage('Authentication failed. Please try again.');
          return;
        }

        // Flow 2: PKCE code exchange (fallback for Supabase built-in OAuth)
        const code = urlParams.get('code') || hashParams.get('code');
        if (code) {
          logger.debug('Processing PKCE code exchange');

          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            logger.error('PKCE code exchange failed:', exchangeError);
            setStatus('error');
            setErrorMessage(exchangeError.message || 'Failed to complete authentication.');
            return;
          }

          if (data.session) {
            logger.debug('PKCE code exchanged, session created. Waiting for admin verification...');
            return;
          }
        }

        // Flow 3: Legacy hash-based tokens (Supabase auto-detects via detectSessionInUrl)
        // Check for legacy state parameter for CSRF protection
        if (!stateVerifiedRef.current) {
          stateVerifiedRef.current = true;
          const stateParam = urlParams.get('state') || hashParams.get('state');

          if (stateParam) {
            // verifyOAuthState now validates provider binding when metadata is available
            // For legacy states without provider binding, it falls back to basic state matching
            const stateResult = await verifyOAuthState(stateParam);
            if (!stateResult.valid) {
              logger.error('OAuth state verification failed:', stateResult.error);
              setStatus('error');
              setErrorMessage('Security validation failed. Please try again.');
              return;
            }
            logger.debug('Legacy OAuth state verified successfully');
          }
          // For the proxy flow, state is handled server-side, so missing state is OK
        }

        // If we have hash tokens, Supabase will auto-process them
        if (window.location.hash && window.location.hash.includes('access_token')) {
          logger.debug('Hash tokens detected, Supabase will auto-process');
          return;
        }

        // No recognizable auth data in URL - might be a stale page load
        // Wait briefly for AuthContext to process any tokens
        logger.debug('No explicit tokens found, waiting for AuthContext...');
      } catch (err) {
        logger.error('Error processing OAuth callback:', err);
        setStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'An error occurred during authentication.');
      }
    };

    processTokens();
  }, [searchParams]);

  // Step 2: React to auth status changes from AuthContext
  useEffect(() => {
    if (status === 'error') return; // Don't override error state
    if (hasRedirected) return;

    logger.debug('AuthCallback: Auth status changed to:', authStatus);

    switch (authStatus) {
      case 'initializing':
      case 'verifying_admin':
        setStatus('processing');
        break;

      case 'admin_verified':
        setStatus('success');
        setHasRedirected(true);

        // Get return URL or default to dashboard (re-validate on read)
        {
          const storedUrl = sessionStorage.getItem('auth_return_url') || '/admin/dashboard';
          sessionStorage.removeItem('auth_return_url');
          const returnUrl = isValidRedirectUrl(storedUrl) ? storedUrl : '/admin/dashboard';

          logger.info('OAuth callback: Admin verified, redirecting to:', returnUrl);

          setTimeout(() => {
            navigate(returnUrl, { replace: true });
          }, 1000);
        }
        break;

      case 'authenticated':
        // User is authenticated but NOT an admin
        setStatus('error');
        setHasRedirected(true);
        setErrorMessage('Access denied. Your account is not authorized for admin access.');
        logger.warn('OAuth callback: User authenticated but not admin');
        break;

      case 'unauthenticated':
        // Only show error if we've been processing for a while
        // (initial unauthenticated state is expected before tokens are processed)
        break;

      case 'error':
        setStatus('error');
        setHasRedirected(true);
        setErrorMessage(authError || 'An error occurred during authentication.');
        logger.error('OAuth callback: Auth error state');
        break;
    }
  }, [authStatus, isAdminVerified, authError, navigate, hasRedirected, status]);

  // Step 3: Timeout - if still processing after 30 seconds, show error
  useEffect(() => {
    if (status !== 'processing') return;

    const timeout = setTimeout(() => {
      if (status === 'processing') {
        setStatus('error');
        setErrorMessage('Authentication timed out. Please try again.');
        logger.error('OAuth callback: Timeout waiting for auth');
      }
    }, 30000);

    return () => clearTimeout(timeout);
  }, [status]);

  const handleRetry = () => {
    navigate('/admin/login', { replace: true });
  };

  const handleGoHome = () => {
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {status === 'processing' && (
              <Loader2 className="h-6 w-6 text-primary animate-spin" />
            )}
            {status === 'success' && (
              <CheckCircle className="h-6 w-6 text-green-500" />
            )}
            {status === 'error' && (
              <AlertCircle className="h-6 w-6 text-destructive" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">
            {status === 'processing' && 'Signing you in...'}
            {status === 'success' && 'Welcome!'}
            {status === 'error' && 'Sign In Failed'}
          </CardTitle>
          <CardDescription>
            {status === 'processing' && 'Please wait while we verify your credentials.'}
            {status === 'success' && 'Redirecting to dashboard...'}
            {status === 'error' && 'We encountered an issue with your sign in.'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {status === 'processing' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                <div className="bg-primary h-full animate-pulse w-2/3"></div>
              </div>
              <p className="text-sm text-muted-foreground">
                Verifying admin access...
              </p>
            </div>
          )}

          {status === 'success' && (
            <div className="flex flex-col items-center gap-4">
              <div className="w-full bg-green-100 dark:bg-green-900/20 rounded-full h-2 overflow-hidden">
                <div className="bg-green-500 h-full w-full"></div>
              </div>
              <p className="text-sm text-green-600 dark:text-green-400">
                Authentication successful!
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-col gap-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {errorMessage}
                </AlertDescription>
              </Alert>

              <div className="flex flex-col gap-2">
                <Button onClick={handleRetry} className="w-full">
                  Try Again
                </Button>
                <Button onClick={handleGoHome} variant="outline" className="w-full">
                  Go to Homepage
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AuthCallback;
