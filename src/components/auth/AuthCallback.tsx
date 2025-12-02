import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { verifyOAuthState } from '@/lib/oauth-state';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, CheckCircle } from 'lucide-react';

/**
 * AuthCallback component
 *
 * Handles OAuth redirect callbacks from Google, Apple, etc.
 * This component is rendered at /auth/callback and processes the
 * authentication tokens from the URL hash fragment.
 *
 * Flow:
 * 1. User clicks OAuth button -> redirected to provider
 * 2. Provider authenticates -> redirects back here with tokens in URL
 * 3. Supabase automatically processes tokens (detectSessionInUrl: true)
 * 4. AuthContext receives SIGNED_IN event -> verifies admin access
 * 5. This component waits for auth status and redirects accordingly
 */
const AuthCallback = () => {
  const navigate = useNavigate();
  const { authStatus, isAdminVerified, error: authError } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasRedirected, setHasRedirected] = useState(false);
  const stateVerifiedRef = useRef(false);

  useEffect(() => {
    logger.debug('AuthCallback: Current auth status:', authStatus);

    // Check for error in URL params (OAuth errors)
    const urlParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.substring(1));

    const urlError = urlParams.get('error') || hashParams.get('error');
    const errorDescription = urlParams.get('error_description') || hashParams.get('error_description');

    if (urlError) {
      logger.error('OAuth error from URL:', urlError, errorDescription);
      setStatus('error');
      setErrorMessage(errorDescription || urlError || 'Authentication failed');
      return;
    }

    // Verify OAuth state parameter for CSRF protection (only once)
    if (!stateVerifiedRef.current) {
      stateVerifiedRef.current = true;

      // Get state from URL params or hash
      const stateParam = urlParams.get('state') || hashParams.get('state');

      // Only verify state if one was provided (some flows may not include it)
      if (stateParam) {
        const stateResult = verifyOAuthState(stateParam);
        if (!stateResult.valid) {
          logger.error('OAuth state verification failed:', stateResult.error);
          setStatus('error');
          setErrorMessage('Security validation failed. Please try again.');
          return;
        }
        logger.debug('OAuth state verified successfully');
      } else {
        // If no state was provided, log a warning but continue
        // This handles cases where OAuth provider doesn't return state
        logger.warn('No OAuth state parameter in callback - CSRF protection not applied');
      }
    }

    // Handle different auth statuses
    switch (authStatus) {
      case 'initializing':
      case 'verifying_admin':
        // Still processing
        setStatus('processing');
        break;

      case 'admin_verified':
        // Success - admin access verified
        if (!hasRedirected) {
          setStatus('success');
          setHasRedirected(true);

          // Get return URL or default to dashboard
          const returnUrl = sessionStorage.getItem('auth_return_url') || '/admin/dashboard';
          sessionStorage.removeItem('auth_return_url');

          logger.info('OAuth callback: Admin verified, redirecting to:', returnUrl);

          // Small delay to show success state
          setTimeout(() => {
            navigate(returnUrl, { replace: true });
          }, 1000);
        }
        break;

      case 'authenticated':
        // User is authenticated but NOT an admin
        if (!hasRedirected) {
          setStatus('error');
          setHasRedirected(true);
          setErrorMessage('Access denied. Your account is not authorized for admin access.');
          logger.warn('OAuth callback: User authenticated but not admin');
        }
        break;

      case 'unauthenticated':
        // Auth failed
        if (!hasRedirected) {
          setStatus('error');
          setHasRedirected(true);
          setErrorMessage(authError || 'Authentication failed. Please try again.');
          logger.warn('OAuth callback: Authentication failed');
        }
        break;

      case 'error':
        // General error
        if (!hasRedirected) {
          setStatus('error');
          setHasRedirected(true);
          setErrorMessage(authError || 'An error occurred during authentication.');
          logger.error('OAuth callback: Auth error state');
        }
        break;

      default:
        logger.debug('OAuth callback: Unknown auth status:', authStatus);
    }
  }, [authStatus, isAdminVerified, authError, navigate, hasRedirected]);

  // Timeout - if still processing after 30 seconds, show error
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
