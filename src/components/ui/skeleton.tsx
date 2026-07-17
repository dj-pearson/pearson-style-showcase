import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // The `skeleton` marker lets reduced-motion CSS swap the pulse for a
      // gentle opacity fade instead of freezing it (see index.css).
      className={cn('skeleton animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

export { Skeleton };
