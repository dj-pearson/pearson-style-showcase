import { Skeleton } from '@/components/ui/skeleton';

/**
 * SuspenseFallback - Consistent loading skeleton for lazy-loaded routes.
 * Shows animated placeholders that approximate a typical page layout.
 * Respects prefers-reduced-motion by using opacity fade instead of shimmer.
 */
const SuspenseFallback = () => {
  return (
    <div
      className="min-h-screen bg-background"
      role="status"
      aria-label="Loading page content"
      aria-busy="true"
    >
      {/* Navigation placeholder */}
      <div className="h-16 border-b border-border/40 flex items-center px-6">
        <Skeleton className="h-8 w-32" />
        <div className="ml-auto flex gap-4">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-16" />
        </div>
      </div>

      {/* Page content skeleton */}
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Hero / title area */}
        <div className="space-y-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-5 w-1/2" />
        </div>

        {/* Content blocks */}
        <div className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>

        {/* Card grid placeholder */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-40 w-full rounded-lg" />
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>

      {/* Screen reader loading text */}
      <span className="sr-only">Loading page content, please wait...</span>
    </div>
  );
};

export default SuspenseFallback;
