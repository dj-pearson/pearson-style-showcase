import * as React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Mail, ArrowRight, CheckCircle } from 'lucide-react';
import { useAnalytics } from '@/components/Analytics';
import { invokeEdgeFunction } from '@/lib/edge-functions';
import { logger } from '@/lib/logger';
import { validateEmail } from '@/lib/security';
import { cn } from '@/lib/utils';

interface NewsletterSignupProps {
  /** Inline variant for the end of an article: no icon, smaller heading, less padding. */
  compact?: boolean;
}

type Result = { email: string; alreadySubscribed: boolean };

const INVALID_EMAIL = 'Please enter a valid email address';

/*
 * A plain controlled form on purpose. This renders on the homepage, and
 * react-hook-form + zod pulled a 24 KB gzipped form-vendor chunk onto that
 * page for a single email field.
 */
const NewsletterSignup = ({ compact = false }: NewsletterSignupProps) => {
  const id = React.useId();
  const fieldId = `${id}-email`;
  const errorId = `${id}-email-error`;
  const [email, setEmail] = React.useState('');
  const [fieldError, setFieldError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);
  const { trackNewsletterSignup } = useAnalytics();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const valid = validateEmail(email);
    if (!valid) {
      setFieldError(INVALID_EMAIL);
      return;
    }

    setFieldError(null);
    setSubmitError(false);
    setIsSubmitting(true);
    trackNewsletterSignup('attempt');

    try {
      const { data, error } = await invokeEdgeFunction('newsletter-signup', {
        body: { email: valid },
      });

      if (error) throw error;

      // The function answers an address it already holds with 200 and a
      // message saying so. That is not a new lead, so it is not tracked as one.
      const message: unknown = data?.message;
      const alreadySubscribed = typeof message === 'string' && /already/i.test(message);
      if (!alreadySubscribed) trackNewsletterSignup('success');

      setResult({ email: valid, alreadySubscribed });
    } catch (error) {
      logger.error('Newsletter signup failed:', error);
      trackNewsletterSignup('failure');
      setSubmitError(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const heading = compact ? 'text-lg sm:text-xl' : 'text-xl sm:text-2xl';

  return (
    <Card className="bg-card border-primary/20">
      <CardContent className={compact ? 'p-5 sm:p-6' : 'p-6 sm:p-8'}>
        {result ? (
          <div role="status" className={cn(!compact && 'text-center')}>
            <CheckCircle
              className={cn('w-8 h-8 text-primary mb-3', !compact && 'mx-auto')}
              aria-hidden="true"
            />
            <h3 className={cn(heading, 'font-bold mb-2')}>
              {result.alreadySubscribed ? "You're already on the list." : "You're in."}
            </h3>
            <p className="text-muted-foreground">
              {result.alreadySubscribed ? (
                <>
                  <span className="font-medium text-foreground">{result.email}</span> is already
                  subscribed, so there&apos;s nothing more to do.
                </>
              ) : (
                <>
                  Check <span className="font-medium text-foreground">{result.email}</span> for the
                  welcome note.
                </>
              )}
            </p>
          </div>
        ) : (
          <>
            <div className={cn('mb-6', !compact && 'text-center')}>
              {!compact && (
                <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                  <Mail className="w-6 h-6 text-primary" aria-hidden="true" />
                </div>
              )}
              <h3 className={cn(heading, 'font-bold mb-2')}>The pipeline notes</h3>
              <p className="text-muted-foreground">
                One email when a new teardown or CRM automation guide goes up. What broke, why, and
                the fix. No more than twice a month.
              </p>
            </div>

            <form onSubmit={onSubmit} noValidate className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label htmlFor={fieldId} className="sr-only">
                    Email address
                  </label>
                  <Input
                    id={fieldId}
                    type="email"
                    autoComplete="email"
                    spellCheck={false}
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (fieldError) setFieldError(null);
                    }}
                    disabled={isSubmitting}
                    aria-invalid={fieldError ? true : undefined}
                    aria-describedby={fieldError ? errorId : undefined}
                    className={fieldError ? 'border-destructive' : ''}
                  />
                  {fieldError && (
                    <p id={errorId} role="alert" className="text-sm text-destructive mt-1">
                      {fieldError}
                    </p>
                  )}
                </div>
                <Button type="submit" disabled={isSubmitting} className="whitespace-nowrap">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Subscribing...
                    </>
                  ) : (
                    <>
                      Subscribe
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
              </div>

              {submitError && (
                <p role="alert" className="text-sm text-destructive">
                  That didn&apos;t go through. Try again in a minute.
                </p>
              )}

              <p className={cn('text-xs text-muted-foreground', !compact && 'text-center')}>
                Unsubscribe at any time. By subscribing you agree to the{' '}
                <Link to="/privacy" className="underline underline-offset-2 hover:text-primary">
                  Privacy Policy
                </Link>
                .
              </p>
            </form>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default NewsletterSignup;
