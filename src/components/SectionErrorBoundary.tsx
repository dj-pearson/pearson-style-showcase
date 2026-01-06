import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { logger } from '@/lib/logger';
import { captureReactError } from '@/lib/error-tracking';

interface Props {
  children: ReactNode;
  /** Section name for error identification */
  sectionName: string;
  /** Optional custom fallback UI */
  fallback?: ReactNode;
  /** Whether to show a compact error view */
  compact?: boolean;
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * SectionErrorBoundary - Granular error boundary for individual page sections
 *
 * Use this to wrap sections that might fail independently without crashing the entire page.
 * Perfect for admin dashboard sections, data-heavy components, or third-party integrations.
 *
 * @example
 * <SectionErrorBoundary sectionName="Analytics Dashboard">
 *   <AnalyticsWidget />
 * </SectionErrorBoundary>
 */
class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { sectionName, onError } = this.props;

    // Log the error with section context
    logger.error(`SectionErrorBoundary [${sectionName}] caught an error:`, error, errorInfo);

    // Send to error tracking service in production
    if (import.meta.env.PROD) {
      captureReactError(error, {
        componentStack: errorInfo.componentStack || undefined,
        section: sectionName,
      });
    }

    // Call optional error callback
    onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render() {
    const { hasError, error } = this.state;
    const { children, sectionName, fallback, compact = false } = this.props;

    if (hasError) {
      // Custom fallback UI if provided
      if (fallback) {
        return fallback;
      }

      // Compact error view for smaller sections
      if (compact) {
        return (
          <div
            className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg"
            role="alert"
            aria-live="assertive"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" aria-hidden="true" />
                <span>Failed to load {sectionName}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleRetry}
                aria-label={`Retry loading ${sectionName}`}
              >
                <RefreshCw className="h-3 w-3 mr-1" aria-hidden="true" />
                Retry
              </Button>
            </div>
          </div>
        );
      }

      // Standard error view
      return (
        <Alert
          variant="destructive"
          className="my-4"
          role="alert"
          aria-live="assertive"
        >
          <AlertCircle className="h-4 w-4" aria-hidden="true" />
          <AlertTitle>Error loading {sectionName}</AlertTitle>
          <AlertDescription className="space-y-3">
            <p>
              This section encountered an unexpected error. The rest of the page should still work normally.
            </p>

            {/* Show error details in development */}
            {import.meta.env.DEV && error && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm hover:underline">
                  View error details
                </summary>
                <pre className="mt-2 text-xs bg-background/50 p-2 rounded overflow-auto max-h-32">
                  {error.message}
                </pre>
              </details>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={this.handleRetry}
                aria-label={`Retry loading ${sectionName}`}
              >
                <RefreshCw className="h-4 w-4 mr-2" aria-hidden="true" />
                Try Again
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      );
    }

    return children;
  }
}

export default SectionErrorBoundary;
