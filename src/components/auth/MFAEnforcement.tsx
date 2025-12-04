import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Shield,
  Smartphone,
  Copy,
  Check,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { toast } from 'sonner';

interface MFAEnforcementProps {
  open: boolean;
  onMFASetupComplete: () => void;
  onSkip?: () => void;
  allowSkip?: boolean;
  gracePeriodDays?: number;
}

interface TOTPEnrollment {
  id: string;
  type: 'totp';
  totp: {
    qr_code: string;
    secret: string;
    uri: string;
  };
}

const MFAEnforcement: React.FC<MFAEnforcementProps> = ({
  open,
  onMFASetupComplete,
  onSkip,
  allowSkip = false,
  gracePeriodDays = 0,
}) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'intro' | 'setup' | 'verify'>('intro');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrollment, setEnrollment] = useState<TOTPEnrollment | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('intro');
      setError(null);
      setEnrollment(null);
      setVerificationCode('');
      setFactorId(null);
    }
  }, [open]);

  /**
   * Check if user already has MFA enrolled
   */
  const checkExistingMFA = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();

      if (error) {
        logger.error('Failed to list MFA factors:', error);
        return false;
      }

      // Check if user has any verified TOTP factors
      const hasVerifiedTOTP = data.totp.some(
        (factor) => factor.status === 'verified'
      );

      if (hasVerifiedTOTP) {
        logger.info('User already has MFA enabled');
        return true;
      }

      return false;
    } catch (err) {
      logger.error('Error checking MFA status:', err);
      return false;
    }
  };

  /**
   * Start MFA enrollment process
   */
  const startEnrollment = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Check if already enrolled
      const alreadyEnrolled = await checkExistingMFA();
      if (alreadyEnrolled) {
        onMFASetupComplete();
        return;
      }

      // Enroll in TOTP
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: `Admin Portal - ${user?.email}`,
      });

      if (error) {
        logger.error('MFA enrollment failed:', error);
        setError(error.message);
        return;
      }

      if (data) {
        setEnrollment(data as TOTPEnrollment);
        setFactorId(data.id);
        setStep('setup');
        logger.info('MFA enrollment started');
      }
    } catch (err) {
      logger.error('MFA enrollment error:', err);
      setError('Failed to start MFA setup. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Copy secret to clipboard
   */
  const copySecret = async () => {
    if (!enrollment?.totp.secret) return;

    try {
      await navigator.clipboard.writeText(enrollment.totp.secret);
      setCopied(true);
      toast.success('Secret copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy secret');
    }
  };

  /**
   * Verify the TOTP code and complete enrollment
   */
  const verifyCode = async () => {
    if (!factorId || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Challenge the factor
      const { data: challengeData, error: challengeError } =
        await supabase.auth.mfa.challenge({
          factorId,
        });

      if (challengeError) {
        logger.error('MFA challenge failed:', challengeError);
        setError(challengeError.message);
        return;
      }

      // Verify the code
      const { data: verifyData, error: verifyError } =
        await supabase.auth.mfa.verify({
          factorId,
          challengeId: challengeData.id,
          code: verificationCode,
        });

      if (verifyError) {
        logger.error('MFA verification failed:', verifyError);
        setError('Invalid verification code. Please try again.');
        return;
      }

      if (verifyData) {
        logger.info('MFA setup completed successfully');
        toast.success('Two-factor authentication enabled successfully!');
        onMFASetupComplete();
      }
    } catch (err) {
      logger.error('MFA verification error:', err);
      setError('Verification failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle skip with warning
   */
  const handleSkip = () => {
    if (onSkip) {
      logger.warn('User skipped MFA setup');
      onSkip();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="sm:max-w-[500px]"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {step === 'intro' && 'Two-Factor Authentication Required'}
            {step === 'setup' && 'Set Up Authenticator App'}
            {step === 'verify' && 'Verify Your Code'}
          </DialogTitle>
          <DialogDescription>
            {step === 'intro' &&
              'Your organization requires two-factor authentication for admin access.'}
            {step === 'setup' &&
              'Scan the QR code with your authenticator app (Google Authenticator, Authy, etc.)'}
            {step === 'verify' &&
              'Enter the 6-digit code from your authenticator app'}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step: Intro */}
        {step === 'intro' && (
          <div className="space-y-6 py-4">
            <div className="flex items-start gap-4">
              <div className="rounded-full bg-primary/10 p-3">
                <Smartphone className="h-6 w-6 text-primary" />
              </div>
              <div className="space-y-1">
                <h3 className="font-medium">Why is this required?</h3>
                <p className="text-sm text-muted-foreground">
                  Two-factor authentication adds an extra layer of security to
                  your account by requiring a code from your phone in addition
                  to your password.
                </p>
              </div>
            </div>

            <Card>
              <CardContent className="p-4">
                <h4 className="mb-2 font-medium">You'll need:</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    An authenticator app (Google Authenticator, Authy, 1Password,
                    etc.)
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    Your phone or tablet
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-500" />
                    About 2 minutes to complete setup
                  </li>
                </ul>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-2">
              <Button onClick={startEnrollment} disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    <Shield className="mr-2 h-4 w-4" />
                    Set Up Two-Factor Authentication
                  </>
                )}
              </Button>

              {allowSkip && gracePeriodDays > 0 && (
                <Button variant="ghost" onClick={handleSkip} className="text-sm">
                  Remind me later ({gracePeriodDays} days remaining)
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Step: Setup */}
        {step === 'setup' && (
          <div className="space-y-6 py-4">
            <div className="flex justify-center">
              {enrollment?.totp.qr_code ? (
                <div className="rounded-lg border bg-white p-4">
                  <img
                    src={enrollment.totp.qr_code}
                    alt="TOTP QR Code"
                    className="h-48 w-48"
                  />
                </div>
              ) : (
                <Skeleton className="h-48 w-48" />
              )}
            </div>

            <div className="space-y-2">
              <Label>Can't scan? Enter this code manually:</Label>
              <div className="flex gap-2">
                <Input
                  value={enrollment?.totp.secret || ''}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={copySecret}
                  disabled={!enrollment?.totp.secret}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>

            <Button onClick={() => setStep('verify')} className="w-full">
              I've scanned the QR code
            </Button>
          </div>
        )}

        {/* Step: Verify */}
        {step === 'verify' && (
          <div className="space-y-6 py-4">
            <div className="space-y-2">
              <Label htmlFor="verification-code">Enter verification code</Label>
              <Input
                id="verification-code"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={verificationCode}
                onChange={(e) =>
                  setVerificationCode(e.target.value.replace(/\D/g, ''))
                }
                placeholder="000000"
                className="text-center text-2xl tracking-widest"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Enter the 6-digit code from your authenticator app
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep('setup')}>
                Back
              </Button>
              <Button
                onClick={verifyCode}
                disabled={isLoading || verificationCode.length !== 6}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Enable'
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MFAEnforcement;
