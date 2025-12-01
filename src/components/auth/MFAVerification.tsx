import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Loader2 } from 'lucide-react';
import { logger } from '@/lib/logger';

interface MFAVerificationProps {
  factorId: string;
  onVerificationSuccess: () => void;
  onCancel: () => void;
}

export const MFAVerification = ({ factorId, onVerificationSuccess, onCancel }: MFAVerificationProps) => {
  const [verifyCode, setVerifyCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
        setVerifyCode('');
        setIsLoading(false);
        return;
      }

      logger.debug('MFA verification successful:', verifyData);
      onVerificationSuccess();
    } catch (err) {
      logger.error('Error verifying MFA:', err);
      setError('Verification failed. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Shield className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl font-bold">Two-Factor Authentication</CardTitle>
        <CardDescription>
          Enter the 6-digit code from Google Authenticator
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="verifyCode">Authentication Code</Label>
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && verifyCode.length === 6) {
                verifyMFA();
              }
            }}
            maxLength={6}
            pattern="[0-9]{6}"
            className="text-center text-2xl tracking-widest"
            disabled={isLoading}
            autoFocus
          />
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
              'Verify'
            )}
          </Button>

          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={isLoading}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
