import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SectionSkeletonProps {
  /** Number of placeholder rows to render. */
  rows?: number;
  /** Height of each row (any valid CSS length). */
  rowHeight?: string;
  /** Render a wider header skeleton above the rows. */
  header?: boolean;
  className?: string;
}

/**
 * Generic, configurable loading skeleton for arbitrary content sections.
 * Configure the number of rows, their height, and an optional header block.
 */
export const SectionSkeleton = ({
  rows = 3,
  rowHeight = '1.25rem',
  header = false,
  className,
}: SectionSkeletonProps) => {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-busy="true" aria-label="Loading">
      {header && <Skeleton className="h-7 w-1/3" />}
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="w-full" style={{ height: rowHeight }} />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
};

export default SectionSkeleton;
