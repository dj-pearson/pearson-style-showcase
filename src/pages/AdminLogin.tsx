import { useState, ChangeEvent, FormEvent, useEffect } from 'react';
import { logger } from "@/lib/logger";
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Eye, EyeOff, Shield, Lock, User, ArrowLeft, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { MFAEnrollment } from '@/components/auth/MFAEnrollment';
import { MFAVerification } from '@/components/auth/MFAVerification';

// Google icon component
const GoogleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24">
    <path
      fill="currentColor"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="currentColor"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="currentColor"
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
    />
    <path
      fill="currentColor"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
    />
  </svg>
);

// Apple icon component
const AppleIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
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
  const [authFlow, setAuthFlow] = useState<'login' | 'mfa-enroll' | 'mfa-verify'>('login');
  const [mfaFactorId, setMfaFactorId] = useState<string>('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, signInWithProvider } = useAuth();

  // Check if user needs MFA enrollment after login
  useEffect(() => {
    const checkMFAStatus = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        logger.debug('MFA factors:', factors);
        
        if (!factors?.totp || factors.totp.length === 0) {
          logger.debug('No MFA enrolled, showing enrollment');
          setAuthFlow('mfa-enroll');
        }
      }
    };

    checkMFAStatus();
  }, []);

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
      // First, authenticate with email and password
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });

      if (authError) {
        setError(authError.message);
        setIsLoading(false);
        return;
      }

      // Check if user has MFA enrolled
      const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
      
      if (factorsError) {
        logger.error('Error checking MFA factors:', factorsError);
        setError('Failed to check MFA status');
        setIsLoading(false);
        return;
      }

      logger.debug('MFA factors after login:', factors);

      // If no TOTP factor enrolled, require enrollment
      if (!factors?.totp || factors.totp.length === 0) {
        setAuthFlow('mfa-enroll');
        setIsLoading(false);
        return;
      }

      // If TOTP enrolled, require verification
      const totpFactor = factors.totp[0];
      setMfaFactorId(totpFactor.id);
      setAuthFlow('mfa-verify');
      setIsLoading(false);
    } catch (err) {
      logger.error('Login error:', err);
      setError('Network error. Please try again.');
      setIsLoading(false);
    }
  };

  const handleMFAEnrollmentComplete = async () => {
    toast({
      title: "MFA enabled",
      description: "Two-factor authentication has been set up successfully",
    });

    // Verify admin access after MFA enrollment
    const result = await signIn(formData.email, formData.password);
    
    if (result.success) {
      const returnUrl = sessionStorage.getItem('auth_return_url') || '/admin/dashboard';
      sessionStorage.removeItem('auth_return_url');
      navigate(returnUrl, { replace: true });
    }
  };

  const handleMFAVerificationSuccess = async () => {
    toast({
      title: "Login successful",
      description: "Welcome to the admin dashboard",
    });

    // Verify admin access after MFA verification
    const result = await signIn(formData.email, formData.password);
    
    if (result.success) {
      const returnUrl = sessionStorage.getItem('auth_return_url') || '/admin/dashboard';
      sessionStorage.removeItem('auth_return_url');
      navigate(returnUrl, { replace: true });
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

    // Store return URL before OAuth redirect
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
      // On success, the page will redirect to the OAuth provider
      // No need to set loading to false
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
      const { data, error: functionError } = await supabase.functions.invoke('admin-auth', {
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

  // Show MFA enrollment if required
  if (authFlow === 'mfa-enroll') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <MFAEnrollment
          onEnrollmentComplete={handleMFAEnrollmentComplete}
        />
      </div>
    );
  }

  // Show MFA verification if required
  if (authFlow === 'mfa-verify') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <MFAVerification
          factorId={mfaFactorId}
          onVerificationSuccess={handleMFAVerificationSuccess}
          onCancel={handleMFACancel}
        />
      </div>
    );
  }

  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Link
          to="/"
          className="absolute top-6 left-6 flex items-center space-x-2 text-muted-foreground hover:text-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="text-sm">Back to Homepage</span>
        </Link>

        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
            <CardDescription>
              Enter your email address and we'll send you a reset link
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={forgotPasswordEmail}
                  onChange={(e) => setForgotPasswordEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="flex flex-col space-y-2">
                <Button type="submit" className="w-full" disabled={isLoading}>
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
                  onClick={() => setShowForgotPassword(false)}
                  className="w-full"
                >
                  Back to Login
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Link
        to="/"
        className="absolute top-6 left-6 flex items-center space-x-2 text-muted-foreground hover:text-primary transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm">Back to Homepage</span>
      </Link>

      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Admin Login</CardTitle>
          <CardDescription>
            Sign in to access the admin dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* OAuth Buttons */}
          <div className="space-y-3">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleOAuthSignIn('google')}
              disabled={isLoading || isOAuthLoading !== null}
            >
              {isOAuthLoading === 'google' ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <GoogleIcon />
              )}
              <span className="ml-2">Continue with Google</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => handleOAuthSignIn('apple')}
              disabled={isLoading || isOAuthLoading !== null}
            >
              {isOAuthLoading === 'apple' ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <AppleIcon />
              )}
              <span className="ml-2">Continue with Apple</span>
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="admin@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="pl-10"
                  required
                  autoComplete="email"
                  disabled={isLoading || isOAuthLoading !== null}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="pl-10 pr-10"
                  required
                  autoComplete="current-password"
                  disabled={isLoading || isOAuthLoading !== null}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  disabled={isLoading || isOAuthLoading !== null}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>


            <div className="flex flex-col space-y-2">
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || isOAuthLoading !== null}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowForgotPassword(true)}
                className="w-full text-sm"
                disabled={isLoading || isOAuthLoading !== null}
              >
                Forgot password?
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
