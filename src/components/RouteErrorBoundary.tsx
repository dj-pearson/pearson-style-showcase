import { useRouteError, useNavigate } from 'react-router-dom';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { captureReactError } from '@/lib/error-tracking';
import { logger } from '@/lib/logger';
import { useEffect } from 'react';

/**
 * RouteErrorBoundary - Error element for react-router-dom routes.
 * Catches rendering errors per-route and shows user-friendly recovery UI.
 * Logs errors to tracking service without exposing technical details.
 */
const RouteErrorBoundary = () => {
  const error = useRouteError() as Error;
  const navigate = useNavigate();

  useEffect(() => {
    // Log to error tracking service
    if (error) {
      logger.error('Route error boundary caught error:', error);
      if (import.meta.env.PROD) {
        captureReactError(error, {
          componentStack: 'RouteErrorBoundary',
        });
      }
    }
  }, [error]);

  const handleTryAgain = () => {
    // Reload the current route
    navigate(0);
  };

  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div
      className="min-h-[60vh] flex items-center justify-center p-4"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-2">
            <AlertCircle className="h-6 w-6 text-destructive" aria-hidden="true" />
            <CardTitle>Something went wrong</CardTitle>
          </div>
          <CardDescription>
            This page encountered an unexpected error. Your data is safe.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Show error message only in development */}
          {import.meta.env.DEV && error && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="font-mono text-sm text-destructive break-all">
                {error.message}
              </p>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleTryAgain} variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button onClick={handleGoHome} variant="outline">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            If this problem persists, try clearing your browser cache or contact support.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default RouteErrorBoundary;
