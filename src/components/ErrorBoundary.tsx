import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { logger } from '@/lib/logger';
import { captureReactError } from '@/lib/error-tracking';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isChunkError: boolean;
  isRefreshing: boolean;
}

/**
 * Check if an error is a chunk/module load failure
 * This happens when deployment updates chunk hashes but client has stale references
 */
function isChunkLoadError(error: Error): boolean {
  const message = error.message?.toLowerCase() || '';
  return (
    message.includes('failed to fetch dynamically imported module') ||
    message.includes('loading chunk') ||
    message.includes('loading css chunk') ||
    message.includes('failed to load module script') ||
    (error.name === 'ChunkLoadError')
  );
}

/**
 * ErrorBoundary - Catches React component errors and displays fallback UI
 * Prevents white screen crashes and provides user-friendly error recovery
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isChunkError: false,
      isRefreshing: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    // Also detect if this is a chunk load error
    return {
      hasError: true,
      error,
      isChunkError: isChunkLoadError(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to console in development
    logger.error('ErrorBoundary caught an error:', error, errorInfo);

    // Store error info for display
    this.setState({
      error,
      errorInfo,
    });

    // Send to error tracking service in production
    if (import.meta.env.PROD) {
      this.reportError(error, errorInfo);
    }

    // Auto-recover from chunk load errors after a short delay
    // This prevents the app from being stuck in a broken state
    if (isChunkLoadError(error)) {
      logger.warn('Chunk load error detected, auto-recovering in 3 seconds...');
      setTimeout(() => {
        this.handleChunkErrorRefresh();
      }, 3000);
    }
  }

  /**
   * Report error to tracking service
   * Uses the centralized error tracking service for Sentry/custom endpoint integration
   */
  private reportError(error: Error, errorInfo: ErrorInfo) {
    // Use the centralized error tracking service
    const errorId = captureReactError(error, {
      componentStack: errorInfo.componentStack || undefined,
    });

    if (errorId) {
      logger.info('Error reported to tracking service', { errorId });
    }

    // Also log structured error for server-side collection (e.g., via Cloudflare Analytics)
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      errorId,
    };

    console.error('[ErrorBoundary] Production error:', JSON.stringify(errorReport));
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      isChunkError: false,
      isRefreshing: false,
    });
  };

  /**
   * Handle chunk error by clearing caches and refreshing
   * This is the recommended recovery for stale deployment issues
   */
  handleChunkErrorRefresh = async () => {
    this.setState({ isRefreshing: true });

    try {
      // Clear service worker caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map((cacheName) => caches.delete(cacheName))
        );
        logger.info('Cleared all caches for chunk error recovery');
      }

      // Unregister service workers to ensure fresh load
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map((registration) => registration.unregister())
        );
        logger.info('Unregistered service workers for chunk error recovery');
      }

      // Hard reload to get fresh assets
      window.location.reload();
    } catch (error) {
      logger.error('Error during chunk error recovery:', error);
      // Fallback to simple reload
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Specialized UI for chunk load errors (stale deployment)
      if (this.state.isChunkError) {
        return (
          <div className="min-h-screen flex items-center justify-center p-4 bg-background">
            <Card className="max-w-md w-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Download className="h-6 w-6 text-primary" />
                  <CardTitle>Update Available</CardTitle>
                </div>
                <CardDescription>
                  A new version of the application is available. The page will refresh automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This can happen after we deploy updates. Refreshing will load the latest version.
                </p>

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span>Auto-refreshing in a moment...</span>
                </div>

                <Button
                  onClick={this.handleChunkErrorRefresh}
                  disabled={this.state.isRefreshing}
                  className="w-full"
                  variant="outline"
                >
                  {this.state.isRefreshing ? (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh Now
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        );
      }

      // Default fallback UI for other errors
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <Card className="max-w-2xl w-full">
            <CardHeader>
              <div className="flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-destructive" />
                <CardTitle>Something went wrong</CardTitle>
              </div>
              <CardDescription>
                We encountered an unexpected error. Don't worry, your data is safe.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Error details in development */}
              {import.meta.env.DEV && this.state.error && (
                <div className="p-4 bg-muted rounded-lg">
                  <p className="font-mono text-sm text-destructive mb-2">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                        Stack trace
                      </summary>
                      <pre className="mt-2 text-xs overflow-auto max-h-64 p-2 bg-background rounded">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button onClick={this.handleReset} variant="default">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </Button>
                <Button onClick={() => window.location.href = '/'} variant="outline">
                  Go to Homepage
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  variant="outline"
                >
                  Reload Page
                </Button>
              </div>

              {/* Help text */}
              <p className="text-sm text-muted-foreground">
                If this problem persists, please try clearing your browser cache or contact support.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
