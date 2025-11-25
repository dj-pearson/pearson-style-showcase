import { useState, useEffect, ChangeEvent, FormEvent } from 'react';
import { logger } from "@/lib/logger";
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Shield, Lock, User, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

const AdminLogin = () => {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    totpCode: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [requiresTOTP] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, isAuthenticated, adminUser, isLoading: authLoading } = useAuth();

  // Redirect to dashboard if already authenticated AND admin verified
  // Wait for both conditions to prevent redirect before admin verification completes
  useEffect(() => {
    // Don't redirect while auth is still loading
    if (authLoading) return;

    // Only redirect if both authenticated and have admin user data
    if (isAuthenticated && adminUser) {
      const returnUrl = sessionStorage.getItem('auth_return_url') || '/admin/dashboard';
      sessionStorage.removeItem('auth_return_url');
      logger.debug('Redirecting authenticated admin to:', returnUrl);
      navigate(returnUrl, { replace: true });
    }
  }, [isAuthenticated, adminUser, authLoading, navigate]);

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
      // Use the AuthContext signIn method which handles both auth and admin verification
      const result = await signIn(formData.email, formData.password);

      if (!result.success) {
        setError(result.error || 'Login failed');
        return;
      }

      // Success toast
      toast({
        title: "Login successful",
        description: "Welcome to the admin dashboard",
      });

      // Get return URL from session storage or default to dashboard
      const returnUrl = sessionStorage.getItem('auth_return_url') || '/admin/dashboard';
      sessionStorage.removeItem('auth_return_url');

      logger.info('Navigating to:', returnUrl);
      navigate(returnUrl, { replace: true });
    } catch (error) {
      logger.error('Login error:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
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
    } catch (error) {
      logger.error('Forgot password error:', error);
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (showForgotPassword) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      {/* Back to Homepage Link */}
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
                <Alert>
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
                />
              </div>

              <div className="flex flex-col space-y-2">
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Sending...' : 'Send Reset Email'}
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
        {/* Back to Homepage Link */}
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
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            {error && (
              <Alert>
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
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {requiresTOTP && (
              <div className="space-y-2">
                <Label htmlFor="totpCode">2FA Code</Label>
                <Input
                  id="totpCode"
                  name="totpCode"
                  type="text"
                  placeholder="Enter 6-digit code"
                  value={formData.totpCode}
                  onChange={handleInputChange}
                  maxLength={6}
                  pattern="[0-9]{6}"
                  required
                />
              </div>
            )}

            <div className="flex flex-col space-y-2">
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
              
              <Button
                type="button"
                variant="ghost"
                onClick={() => setShowForgotPassword(true)}
                className="w-full text-sm"
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