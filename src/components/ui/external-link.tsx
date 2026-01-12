import React from 'react';
import { ExternalLink as ExternalLinkIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExternalLinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  /** Whether to show the external link icon */
  showIcon?: boolean;
  /** Screen reader text for the external link indicator */
  srText?: string;
  /** Additional class names */
  className?: string;
  /** The link content */
  children: React.ReactNode;
}

/**
 * Accessible external link component that:
 * - Opens in a new tab with proper security attributes
 * - Announces to screen readers that link opens in new window
 * - Optionally displays visual external link indicator
 * - Prevents security vulnerabilities with rel="noopener noreferrer"
 */
const ExternalLinkComponent = React.forwardRef<HTMLAnchorElement, ExternalLinkProps>(
  (
    {
      href,
      showIcon = true,
      srText = '(opens in new tab)',
      className,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <a
        ref={ref}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center gap-1 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
          className
        )}
        {...props}
      >
        {children}
        {showIcon && (
          <ExternalLinkIcon
            className="w-3.5 h-3.5 flex-shrink-0"
            aria-hidden="true"
          />
        )}
        <span className="sr-only">{srText}</span>
      </a>
    );
  }
);

ExternalLinkComponent.displayName = 'ExternalLink';

export default ExternalLinkComponent;
