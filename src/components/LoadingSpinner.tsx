import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
  text?: string;
}

const LoadingSpinner = ({ size = 'md', className, text }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  const loadingText = text || 'Loading';

  return (
    <div
      role="status"
      aria-label={loadingText}
      aria-busy="true"
      className={cn('flex flex-col items-center justify-center gap-2', className)}
    >
      <Loader2 className={cn('animate-spin text-primary', sizeClasses[size])} aria-hidden="true" />
      {text ? (
        <p className="text-sm text-muted-foreground animate-pulse">{text}</p>
      ) : (
        <span className="sr-only">{loadingText}</span>
      )}
    </div>
  );
};

export default LoadingSpinner;