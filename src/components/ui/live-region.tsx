import React, { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';

interface LiveRegionProps {
  /** The message to announce */
  message: string | null;
  /** Politeness level: 'polite' waits for user to finish, 'assertive' interrupts */
  politeness?: 'polite' | 'assertive';
  /** Whether the region is atomic (announce entire region vs changes) */
  atomic?: boolean;
  /** Relevant changes to announce: 'additions', 'removals', 'text', 'all' */
  relevant?: 'additions' | 'removals' | 'text' | 'all' | 'additions text' | 'additions removals';
  /** Optional ID for the live region */
  id?: string;
  /** Whether to visually hide the region (default: true) */
  visuallyHidden?: boolean;
  /** Additional class names */
  className?: string;
  /** Clear message after delay (ms). Set to 0 to disable auto-clear */
  clearAfter?: number;
}

/**
 * LiveRegion component - announces dynamic content changes to screen readers.
 *
 * Use cases:
 * - Form validation errors
 * - Status updates (loading, success, error)
 * - Search results count
 * - Toast/notification announcements
 * - Dynamic content updates
 *
 * @example
 * // Form error announcement
 * <LiveRegion
 *   message={error}
 *   politeness="assertive"
 *   role="alert"
 * />
 *
 * @example
 * // Search results
 * <LiveRegion
 *   message={`${results.length} results found`}
 *   politeness="polite"
 * />
 */
const LiveRegion: React.FC<LiveRegionProps> = ({
  message,
  politeness = 'polite',
  atomic = true,
  relevant = 'additions text',
  id,
  visuallyHidden = true,
  className,
  clearAfter = 5000
}) => {
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Update message
    setCurrentMessage(message);

    // Auto-clear after delay if enabled and message exists
    if (message && clearAfter > 0) {
      timeoutRef.current = setTimeout(() => {
        setCurrentMessage(null);
      }, clearAfter);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [message, clearAfter]);

  return (
    <div
      id={id}
      role="status"
      aria-live={politeness}
      aria-atomic={atomic}
      aria-relevant={relevant}
      className={cn(
        visuallyHidden && 'sr-only',
        className
      )}
    >
      {currentMessage}
    </div>
  );
};

/**
 * AlertRegion component - a more urgent variant of LiveRegion
 * that uses role="alert" for immediate screen reader announcements.
 *
 * Use for:
 * - Error messages
 * - Warning notifications
 * - Time-sensitive information
 */
export const AlertRegion: React.FC<Omit<LiveRegionProps, 'politeness'>> = (props) => {
  return (
    <div
      id={props.id}
      role="alert"
      aria-live="assertive"
      aria-atomic={props.atomic ?? true}
      className={cn(
        props.visuallyHidden !== false && 'sr-only',
        props.className
      )}
    >
      {props.message}
    </div>
  );
};

export default LiveRegion;
