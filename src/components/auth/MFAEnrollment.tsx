import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2, CheckCircle } from 'lucide-react';
import { logger } from '@/lib/logger';
import QRCode from 'qrcode';

interface MFAEnrollmentProps {
  onEnrollmentComplete: () => void;
  onSkip?: () => void;
}

export const MFAEnrollment = ({ onEnrollmentComplete, onSkip }: MFAEnrollmentProps) => {
  const [step, setStep] = useState<'generate' | 'verify'>('generate');
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [factorId, setFactorId] = useState<string>('');
  const [verifyCode, setVerifyCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    generateMFA();
  }, []);

  const generateMFA = async () => {
    setIsLoading(true);
    setError('');

    try {
      const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Google Authenticator'
      });

      if (enrollError) {
        logger.error('MFA enrollment error:', enrollError);
        setError(enrollError.message);
        setIsLoading(false);
        return;
      }

      if (!enrollData) {
        setError('Failed to generate MFA credentials');
        setIsLoading(false);
        return;
      }

      logger.debug('MFA enrollment data:', enrollData);

      // Generate QR code from the URI
      const qrCodeDataUrl = await QRCode.toDataURL(enrollData.totp.qr_code);
      setQrCode(qrCodeDataUrl);
      setSecret(enrollData.totp.secret);
      setFactorId(enrollData.id);
      setStep('verify');
    } catch (err) {
      logger.error('Error generating MFA:', err);
      setError('Failed to generate MFA. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const verifyMFA = async () => {
    if (!verifyCode || verifyCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
        factorId
      });

      if (challengeError) {
        logger.error('MFA challenge error:', challengeError);
        setError(challengeError.message);
        setIsLoading(false);
        return;
      }

      const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challengeData.id,
        code: verifyCode
      });

      if (verifyError) {
        logger.error('MFA verification error:', verifyError);
        setError('Invalid code. Please try again.');
        setIsLoading(false);
        return;
      }

      logger.debug('MFA verification successful:', verifyData);
      onEnrollmentComplete();
    } catch (err) {
      logger.error('Error verifying MFA:', err);
      setError('Verification failed. Please try again.');
      setIsLoading(false);
    }
  };

  if (step === 'generate' && isLoading) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Generating MFA credentials...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">Set Up Two-Factor Authentication</CardTitle>
        <CardDescription>
          Secure your account with Google Authenticator
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 'verify' && (
          <>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  Scan this QR code with Google Authenticator
                </p>
                {qrCode && (
                  <div className="flex justify-center mb-4">
                    <img src={qrCode} alt="QR Code" className="w-64 h-64" />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs font-medium">Manual Entry Key</Label>
                <div className="p-3 bg-muted rounded-md">
                  <code className="text-xs break-all">{secret}</code>
                </div>
                <p className="text-xs text-muted-foreground">
                  If you can't scan the QR code, enter this key manually in your authenticator app
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="verifyCode">Enter 6-digit code</Label>
                <Input
                  id="verifyCode"
                  type="text"
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setVerifyCode(value);
                    setError('');
                  }}
                  maxLength={6}
                  pattern="[0-9]{6}"
                  className="text-center text-2xl tracking-widest"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="flex flex-col space-y-2">
              <Button
                onClick={verifyMFA}
                disabled={isLoading || verifyCode.length !== 6}
                className="w-full"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Verify and Enable
                  </>
                )}
              </Button>

              {onSkip && (
                <Button
                  variant="ghost"
                  onClick={onSkip}
                  disabled={isLoading}
                  className="w-full"
                >
                  Skip for now
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};
