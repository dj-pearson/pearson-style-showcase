import { useState, ChangeEvent, FormEvent, useEffect, useCallback, useRef, useMemo } from 'react';
import { logger } from "@/lib/logger";
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Shield, Lock, Mail, ArrowLeft, Loader2, Fingerprint } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase, isApiReachable } from '@/integrations/supabase/client';
import { invokeEdgeFunction } from '@/lib/edge-functions';
import { MFAEnrollment } from '@/components/auth/MFAEnrollment';
import { MFAVerification } from '@/components/auth/MFAVerification';
import SEO from '@/components/SEO';

// Google icon with brand colors
const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);

// Apple icon
const AppleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
  </svg>
);

// Animated background grid component
const AnimatedGrid = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    {/* Gradient mesh background */}
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(195_100%_50%/0.08),transparent_50%),radial-gradient(ellipse_at_bottom_left,hsl(280_100%_70%/0.06),transparent_50%)]" />

    {/* Grid pattern */}
    <div
      className="absolute inset-0 opacity-[0.03]"
      style={{
        backgroundImage: `linear-gradient(hsl(195 100% 50%) 1px, transparent 1px),
                         linear-gradient(90deg, hsl(195 100% 50%) 1px, transparent 1px)`,
        backgroundSize: '60px 60px',
      }}
    />

    {/* Floating orbs */}
    <div className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-[hsl(195_100%_50%/0.04)] blur-3xl animate-float-slow" />
    <div className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full bg-[hsl(280_100%_70%/0.03)] blur-3xl animate-float-delayed" />
    <div className="absolute top-2/3 left-1/2 w-48 h-48 rounded-full bg-[hsl(210_100%_60%/0.05)] blur-3xl animate-float-slow-reverse" />

    {/* Scan line effect */}
    <div className="absolute inset-0 overflow-hidden">
      <div className="absolute w-full h-px bg-gradient-to-r from-transparent via-[hsl(195_100%_50%/0.15)] to-transparent animate-scan-line" />
    </div>
  </div>
);

// Hex pattern decorative element
const HexDecoration = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M50 5L93.3 27.5V72.5L50 95L6.7 72.5V27.5L50 5Z"
      stroke="currentColor"
      strokeWidth="0.5"
      opacity="0.2"
    />
    <path
      d="M50 15L83.3 32.5V67.5L50 85L16.7 67.5V32.5L50 15Z"
      stroke="currentColor"
      strokeWidth="0.5"
      opacity="0.15"
    />
    <path
      d="M50 25L73.3 37.5V62.5L50 75L26.7 62.5V37.5L50 25Z"
      stroke="currentColor"
      strokeWidth="0.3"
      opacity="0.1"
    />
  </svg>
);

const AdminLogin = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    totpCode: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState<'google' | 'apple' | null>(null);
  const [authFlow, setAuthFlow] = useState<'login' | 'mfa-enroll' | 'mfa-verify' | 'awaiting-verification'>('login');
  const [mfaFactorId, setMfaFactorId] = useState<string>('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [error, setError] = useState('');
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signInWithProvider, isAdminVerified, authStatus, error: authError, verifyAdminAccess } = useAuth();

  // Track if we've already started MFA check to prevent duplicate calls
  const mfaCheckInProgressRef = useRef(false);
  // Track if we're awaiting admin verification after MFA
  const awaitingVerificationRef = useRef(false);

  // Generate random particles for the background on mount
  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      top: Math.random() * 100,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 5,
      duration: Math.random() * 3 + 4,
    })),
  []);

  // Redirect to dashboard if admin verified
  useEffect(() => {
    if (isAdminVerified) {
      logger.debug('User admin verified, redirecting to dashboard');
      const returnUrl = sessionStorage.getItem('auth_return_url') || '/admin/dashboard';
      sessionStorage.removeItem('auth_return_url');

      if (awaitingVerificationRef.current) {
        awaitingVerificationRef.current = false;
        toast({
          title: "Login successful",
          description: "Welcome to the admin dashboard",
        });
      }

      navigate(returnUrl, { replace: true });
    }
  }, [isAdminVerified, navigate, toast]);

  // Handle auth status changes - especially for post-MFA verification
  useEffect(() => {
    if (authFlow === 'awaiting-verification') {
      if (authStatus === 'admin_verified') {
        logger.debug('Admin verification succeeded after MFA');
      } else if (authStatus === 'authenticated' || authStatus === 'unauthenticated' || authStatus === 'error') {
        logger.warn('Admin verification failed after MFA, status:', authStatus);
        setError('Access denied. Your account is not authorized for admin access.');
        setAuthFlow('login');
        awaitingVerificationRef.current = false;

        supabase.auth.signOut().catch(err => {
          logger.debug('Sign out error:', err);
        });
      }
    }
  }, [authStatus, authFlow]);

  // Check if user needs MFA enrollment after login
  const checkMFAStatus = useCallback(async () => {
    if (mfaCheckInProgressRef.current) {
      logger.debug('MFA check already in progress, skipping');
      return;
    }

    if (isAdminVerified || authStatus !== 'authenticated') {
      return;
    }

    mfaCheckInProgressRef.current = true;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        logger.debug('No session found during MFA check');
        mfaCheckInProgressRef.current = false;
        return;
      }

      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      logger.debug('AAL data:', aalData);

      if (aalData?.currentLevel === 'aal2') {
        logger.debug('MFA already verified (aal2), awaiting admin verification');
        mfaCheckInProgressRef.current = false;
        return;
      }

      const { data: factors } = await supabase.auth.mfa.listFactors();
      logger.debug('MFA factors:', factors);

      if (!factors?.totp || factors.totp.length === 0) {
        logger.debug('No MFA enrolled, showing enrollment');
        setAuthFlow('mfa-enroll');
      } else if (aalData?.currentLevel === 'aal1' && aalData?.nextLevel === 'aal2') {
        logger.debug('MFA enrolled but not verified, showing verification');
        setMfaFactorId(factors.totp[0].id);
        setAuthFlow('mfa-verify');
      }
    } catch (err) {
      logger.error('Error checking MFA status:', err);
    } finally {
      mfaCheckInProgressRef.current = false;
    }
  }, [isAdminVerified, authStatus]);

  // Trigger MFA check when auth status becomes 'authenticated'
  useEffect(() => {
    if (authStatus === 'authenticated' && authFlow === 'login') {
      checkMFAStatus();
    }
  }, [authStatus, authFlow, checkMFAStatus]);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (authError) {
        setError(authError.message);
        setIsLoading(false);
        return;
      }

      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();

      if (factorsError) {
        logger.error('Error checking MFA factors:', factorsError);
        setError('Failed to check MFA status');
        setIsLoading(false);
        return;
      }

      logger.debug('MFA factors after login:', factors);

      if (!factors?.totp || factors.totp.length === 0) {
        setAuthFlow('mfa-enroll');
        setIsLoading(false);
        return;
      }

      const totpFactor = factors.totp[0];
      setMfaFactorId(totpFactor.id);
      setAuthFlow('mfa-verify');
      setIsLoading(false);
    } catch (err) {
      logger.error('Login error:', err);
      // Detect CORS/network errors and show a specific message
      if (
        (err instanceof TypeError && err.message?.includes('Failed to fetch')) ||
        isApiReachable() === false
      ) {
        setError(
          'Unable to connect to the authentication server. ' +
          'This is likely a CORS configuration issue on api.danpearson.net. ' +
          'Please contact the administrator.'
        );
      } else {
        setError('Network error. Please try again.');
      }
      setIsLoading(false);
    }
  };

  const handleMFAEnrollmentComplete = async () => {
    logger.debug('MFA enrollment complete, triggering admin verification');

    toast({
      title: "MFA enabled",
      description: "Verifying admin access...",
    });

    awaitingVerificationRef.current = true;
    setAuthFlow('awaiting-verification');

    try {
      const verified = await verifyAdminAccess();
      if (!verified) {
        logger.warn('Admin verification returned false after MFA enrollment');
      }
    } catch (err) {
      logger.error('Admin verification error after MFA enrollment:', err);
      setError('Failed to verify admin access. Please try again.');
      setAuthFlow('login');
      awaitingVerificationRef.current = false;
      await supabase.auth.signOut();
    }
  };

  const handleMFAVerificationSuccess = async () => {
    logger.debug('MFA verification complete, triggering admin verification');

    awaitingVerificationRef.current = true;
    setAuthFlow('awaiting-verification');

    try {
      const verified = await verifyAdminAccess();
      if (!verified) {
        logger.warn('Admin verification returned false after MFA verification');
      }
    } catch (err) {
      logger.error('Admin verification error after MFA verification:', err);
      setError('Failed to verify admin access. Please try again.');
      setAuthFlow('login');
      awaitingVerificationRef.current = false;
      await supabase.auth.signOut();
    }
  };

  const handleMFACancel = async () => {
    await supabase.auth.signOut();
    setAuthFlow('login');
    setMfaFactorId('');
    setFormData({ email: '', password: '', totpCode: '' });
  };

  const handleOAuthSignIn = async (provider: 'google' | 'apple') => {
    setIsOAuthLoading(provider);
    setError('');

    const currentReturnUrl = sessionStorage.getItem('auth_return_url');
    if (!currentReturnUrl) {
      sessionStorage.setItem('auth_return_url', '/admin/dashboard');
    }

    try {
      const result = await signInWithProvider(provider);

      if (!result.success) {
        setError(result.error || `${provider} sign in failed`);
        setIsOAuthLoading(null);
      }
    } catch (err) {
      logger.error(`${provider} OAuth error:`, err);
      setError(`Failed to sign in with ${provider}. Please try again.`);
      setIsOAuthLoading(null);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const { data, error: functionError } = await invokeEdgeFunction('admin-auth', {
        body: {
          action: 'forgot-password',
          email: forgotPasswordEmail
        }
      });

      if (functionError) {
        logger.error('Function error:', functionError);
        setError(functionError.message || 'Failed to send reset email');
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      toast({
        title: "Password reset email sent",
        description: "Check your email for reset instructions",
      });
      setShowForgotPassword(false);
      setForgotPasswordEmail('');
    } catch (err) {
      logger.error('Forgot password error:', err);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading while auth is being checked/restored
  if (authStatus === 'initializing' || authStatus === 'verifying_admin' || authFlow === 'awaiting-verification') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background relative overflow-hidden">
        <AnimatedGrid />
        <div className="relative z-10 flex flex-col items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-xl animate-pulse" />
            <div className="relative w-16 h-16 rounded-full border border-primary/30 flex items-center justify-center bg-card/50 backdrop-blur-sm">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
          <div className="text-center space-y-2">
            <p className="text-sm font-medium text-foreground">
              {authStatus === 'initializing' ? 'Initializing...' : 'Verifying access...'}
            </p>
            <p className="text-xs text-muted-foreground">Establishing secure connection</p>
          </div>
        </div>
      </div>
    );
  }

  // Show MFA enrollment
  if (authFlow === 'mfa-enroll') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background relative overflow-hidden px-4">
        <AnimatedGrid />
        <div className="relative z-10">
          <MFAEnrollment onEnrollmentComplete={handleMFAEnrollmentComplete} />
        </div>
      </div>
    );
  }

  // Show MFA verification
  if (authFlow === 'mfa-verify') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background relative overflow-hidden px-4">
        <AnimatedGrid />
        <div className="relative z-10">
          <MFAVerification
            factorId={mfaFactorId}
            onVerificationSuccess={handleMFAVerificationSuccess}
            onCancel={handleMFACancel}
          />
        </div>
      </div>
    );
  }

  // Forgot password view
  if (showForgotPassword) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background relative overflow-hidden px-4">
        <AnimatedGrid />

        <Link
          to="/"
          className="absolute top-6 left-6 z-20 flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors group"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
          <span className="text-sm">Back to site</span>
        </Link>

        <div className="relative z-10 w-full max-w-md">
          {/* Glow effect behind card */}
          <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 via-transparent to-[hsl(280_100%_70%/0.15)] rounded-2xl blur-xl opacity-60" />

          <div className="relative bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl p-8 shadow-2xl">
            <div className="text-center mb-8">
              <div className="mx-auto mb-5 relative w-14 h-14">
                <div className="absolute inset-0 rounded-full bg-primary/15 blur-lg" />
                <div className="relative w-14 h-14 rounded-full border border-primary/30 flex items-center justify-center bg-card/70">
                  <Lock className="h-6 w-6 text-primary" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-1">Reset Password</h1>
              <p className="text-sm text-muted-foreground">
                Enter your email and we'll send you a reset link
              </p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="border-destructive/30 bg-destructive/10">
                  <AlertDescription className="text-sm">{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="reset-email" className="text-sm text-muted-foreground">
                  Email Address
                </Label>
                <div className="relative group">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="you@example.com"
                    value={forgotPasswordEmail}
                    onChange={(e) => setForgotPasswordEmail(e.target.value)}
                    required
                    autoComplete="email"
                    className="pl-10 h-11 bg-background/50 border-border/50 focus:border-primary/50 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>

              <div className="flex flex-col space-y-3 pt-1">
                <Button
                  type="submit"
                  className="w-full h-11 font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    'Send Reset Email'
                  )}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => { setShowForgotPassword(false); setError(''); }}
                  className="w-full text-muted-foreground hover:text-foreground"
                >
                  Back to Sign In
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Main login view
  return (
    <>
    <SEO
      title="Admin Login | Dan Pearson"
      description="Admin login portal"
      noIndex={true}
    />
    <div className="min-h-[100dvh] flex items-center justify-center bg-background relative overflow-hidden px-4 py-8">
      <AnimatedGrid />

      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map(p => (
          <div
            key={p.id}
            className="absolute rounded-full bg-primary/20"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              animation: `float-particle ${p.duration}s ease-in-out ${p.delay}s infinite alternate`,
            }}
          />
        ))}
      </div>

      {/* Decorative hex shapes */}
      <HexDecoration className="absolute top-10 right-10 w-32 h-32 text-primary/30 hidden lg:block" />
      <HexDecoration className="absolute bottom-20 left-10 w-24 h-24 text-[hsl(280_100%_70%/0.2)] hidden lg:block" />

      {/* Back to site link */}
      <Link
        to="/"
        className="absolute top-6 left-6 z-20 flex items-center gap-2 text-muted-foreground hover:text-primary transition-colors group"
      >
        <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
        <span className="text-sm">Back to site</span>
      </Link>

      <div className="relative z-10 w-full max-w-md">
        {/* Glow effect behind card */}
        <div className="absolute -inset-1 bg-gradient-to-br from-primary/20 via-transparent to-[hsl(280_100%_70%/0.15)] rounded-2xl blur-xl opacity-60" />

        {/* Main card */}
        <div className="relative bg-card/80 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl overflow-hidden">
          {/* Top accent line */}
          <div className="h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />

          <div className="p-8">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="mx-auto mb-5 relative w-16 h-16">
                <div className="absolute inset-0 rounded-full bg-primary/15 blur-lg animate-pulse" />
                <div className="relative w-16 h-16 rounded-2xl border border-primary/30 flex items-center justify-center bg-gradient-to-br from-card/90 to-card/50 rotate-45 overflow-hidden">
                  <Shield className="h-7 w-7 text-primary -rotate-45" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-foreground tracking-tight">
                Admin Access
              </h1>
              <p className="text-sm text-muted-foreground mt-1.5">
                Secure authentication required
              </p>
            </div>

            {/* OAuth Buttons */}
            <div className="space-y-3 mb-6">
              <button
                type="button"
                onClick={() => handleOAuthSignIn('google')}
                disabled={isLoading || isOAuthLoading !== null}
                className="w-full flex items-center justify-center gap-3 h-11 px-4 rounded-lg bg-white text-gray-800 font-medium text-sm transition-all hover:bg-gray-50 hover:shadow-lg hover:shadow-white/10 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-200"
              >
                {isOAuthLoading === 'google' ? (
                  <Loader2 className="h-5 w-5 animate-spin text-gray-600" />
                ) : (
                  <GoogleIcon />
                )}
                <span>Continue with Google</span>
              </button>

              <button
                type="button"
                onClick={() => handleOAuthSignIn('apple')}
                disabled={isLoading || isOAuthLoading !== null}
                className="w-full flex items-center justify-center gap-3 h-11 px-4 rounded-lg bg-black text-white font-medium text-sm transition-all hover:bg-gray-900 hover:shadow-lg hover:shadow-black/20 disabled:opacity-50 disabled:cursor-not-allowed border border-gray-800"
              >
                {isOAuthLoading === 'apple' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <AppleIcon />
                )}
                <span>Continue with Apple</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative mb-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border/50" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card/80 px-3 text-xs uppercase tracking-wider text-muted-foreground">
                  or sign in with email
                </span>
              </div>
            </div>

            {/* Email/Password Form */}
            <form onSubmit={handleLogin} className="space-y-4">
              {(error || authError) && (
                <Alert variant="destructive" className="border-destructive/30 bg-destructive/10">
                  <AlertDescription className="text-sm">{error || authError}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm text-muted-foreground">
                  Email
                </Label>
                <div className={`relative group rounded-lg transition-all ${focusedField === 'email' ? 'ring-1 ring-primary/40' : ''}`}>
                  <Mail className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors ${focusedField === 'email' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    onFocus={() => setFocusedField('email')}
                    onBlur={() => setFocusedField(null)}
                    className="pl-10 h-11 bg-background/50 border-border/50 focus:border-primary/50 focus-visible:ring-0 transition-all"
                    required
                    autoComplete="email"
                    disabled={isLoading || isOAuthLoading !== null}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm text-muted-foreground">
                  Password
                </Label>
                <div className={`relative group rounded-lg transition-all ${focusedField === 'password' ? 'ring-1 ring-primary/40' : ''}`}>
                  <Lock className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors ${focusedField === 'password' ? 'text-primary' : 'text-muted-foreground'}`} />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter your password"
                    value={formData.password}
                    onChange={handleInputChange}
                    onFocus={() => setFocusedField('password')}
                    onBlur={() => setFocusedField(null)}
                    className="pl-10 pr-10 h-11 bg-background/50 border-border/50 focus:border-primary/50 focus-visible:ring-0 transition-all"
                    required
                    autoComplete="current-password"
                    disabled={isLoading || isOAuthLoading !== null}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    disabled={isLoading || isOAuthLoading !== null}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => { setShowForgotPassword(true); setError(''); }}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                  disabled={isLoading || isOAuthLoading !== null}
                >
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                className="w-full h-11 font-medium bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:shadow-primary/30 hover:shadow-xl"
                disabled={isLoading || isOAuthLoading !== null}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Fingerprint className="mr-2 h-4 w-4" />
                    Sign In
                  </>
                )}
              </Button>
            </form>
          </div>

          {/* Bottom accent */}
          <div className="px-8 py-4 border-t border-border/30 bg-card/30">
            <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" />
              <span>Protected by multi-factor authentication</span>
            </div>
          </div>
        </div>

        {/* Bottom text */}
        <p className="text-center text-xs text-muted-foreground/60 mt-6">
          Authorized personnel only. All access attempts are logged.
        </p>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes float-particle {
          0% { transform: translateY(0) translateX(0); opacity: 0.3; }
          100% { transform: translateY(-20px) translateX(10px); opacity: 0.8; }
        }

        @keyframes scan-line {
          0% { transform: translateY(-100vh); }
          100% { transform: translateY(100vh); }
        }

        .animate-float-slow {
          animation: float-slow 8s ease-in-out infinite alternate;
        }

        .animate-float-delayed {
          animation: float-slow 10s ease-in-out 2s infinite alternate;
        }

        .animate-float-slow-reverse {
          animation: float-slow-reverse 7s ease-in-out 1s infinite alternate;
        }

        .animate-scan-line {
          animation: scan-line 8s linear infinite;
        }

        @keyframes float-slow {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(30px, -30px) scale(1.1); }
        }

        @keyframes float-slow-reverse {
          0% { transform: translate(0, 0) scale(1); }
          100% { transform: translate(-20px, 20px) scale(0.9); }
        }
      `}</style>
    </div>
    </>
  );
};

export default AdminLogin;
