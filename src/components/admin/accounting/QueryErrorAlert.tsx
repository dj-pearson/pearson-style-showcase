import { AlertCircle, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface QueryLike {
  isError: boolean;
  error: unknown;
  isFetching?: boolean;
  refetch: () => unknown;
}

interface QueryErrorAlertProps {
  queries: QueryLike[];
  /** What failed to load, e.g. "the balance sheet". */
  subject: string;
}

function messageOf(error: unknown): string | null {
  if (error && typeof error === 'object' && 'message' in error) {
    const m = (error as { message?: unknown }).message;
    if (typeof m === 'string' && m) return m;
  }
  return null;
}

/**
 * Shown in place of report figures when a query fails, so a failed load
 * never reads as $0.00. Retry refetches only the queries that failed.
 */
export function QueryErrorAlert({ queries, subject }: QueryErrorAlertProps) {
  const failed = queries.filter((q) => q.isError);
  if (failed.length === 0) return null;
  const detail = failed.map((q) => messageOf(q.error)).find(Boolean);
  const retrying = failed.some((q) => q.isFetching);

  return (
    <Alert variant="destructive">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Couldn't load {subject}</AlertTitle>
      <AlertDescription className="space-y-3">
        <p>
          The figures are hidden rather than shown as zero.
          {detail ? ` The server said: ${detail}` : ''}
        </p>
        <Button
          variant="outline"
          size="sm"
          disabled={retrying}
          onClick={() => failed.forEach((q) => q.refetch())}
        >
          <RefreshCw className={`h-4 w-4 mr-2${retrying ? ' animate-spin' : ''}`} />
          Retry
        </Button>
      </AlertDescription>
    </Alert>
  );
}
