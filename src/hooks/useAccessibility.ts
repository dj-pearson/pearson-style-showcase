import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Accessibility hook providing common a11y patterns and utilities.
 *
 * Features:
 * - Focus management for modals/dialogs
 * - Reduced motion detection
 * - Live region announcements
 * - Keyboard navigation helpers
 * - Screen reader detection (when available)
 */

interface UseAccessibilityOptions {
  /** Whether to enable focus trap (for modals) */
  trapFocus?: boolean;
  /** Whether to restore focus on unmount */
  restoreFocusOnUnmount?: boolean;
  /** Initial announcement for screen readers */
  initialAnnouncement?: string;
}

interface UseAccessibilityReturn {
  /** Whether user prefers reduced motion */
  prefersReducedMotion: boolean;
  /** Whether user prefers high contrast */
  prefersHighContrast: boolean;
  /** Ref to attach to container for focus management */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Announce a message to screen readers via live region */
  announce: (message: string, politeness?: 'polite' | 'assertive') => void;
  /** Set focus to a specific element */
  focusElement: (selector: string | HTMLElement) => void;
  /** Focus the first focusable element in container */
  focusFirst: () => void;
  /** Focus the last focusable element in container */
  focusLast: () => void;
  /** Current announcement (for rendering in live region) */
  announcement: string | null;
  /** Announcement politeness level */
  announcementPoliteness: 'polite' | 'assertive';
}

// Selectors for focusable elements
const FOCUSABLE_SELECTORS = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

/**
 * Hook for common accessibility patterns
 */
export function useAccessibility(
  options: UseAccessibilityOptions = {}
): UseAccessibilityReturn {
  const {
    trapFocus = false,
    restoreFocusOnUnmount = true,
    initialAnnouncement
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const [announcement, setAnnouncement] = useState<string | null>(initialAnnouncement || null);
  const [announcementPoliteness, setAnnouncementPoliteness] = useState<'polite' | 'assertive'>('polite');

  // Detect motion preferences
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  // Detect high contrast preferences
  const [prefersHighContrast, setPrefersHighContrast] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-contrast: more)').matches;
  });

  // Listen for preference changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: more)');

    const handleMotionChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    const handleContrastChange = (e: MediaQueryListEvent) => {
      setPrefersHighContrast(e.matches);
    };

    motionQuery.addEventListener('change', handleMotionChange);
    contrastQuery.addEventListener('change', handleContrastChange);

    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
      contrastQuery.removeEventListener('change', handleContrastChange);
    };
  }, []);

  // Store previous active element and restore on unmount
  useEffect(() => {
    previousActiveElement.current = document.activeElement as HTMLElement;

    return () => {
      if (restoreFocusOnUnmount && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [restoreFocusOnUnmount]);

  // Focus trap implementation
  useEffect(() => {
    if (!trapFocus || !containerRef.current) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !containerRef.current) return;

      const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(
        FOCUSABLE_SELECTORS
      );
      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable?.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [trapFocus]);

  // Announce function for screen readers
  const announce = useCallback((message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    setAnnouncementPoliteness(politeness);
    // Clear first to ensure the announcement is made even if same message
    setAnnouncement(null);
    // Use setTimeout to ensure the clear happens before setting new message
    setTimeout(() => setAnnouncement(message), 50);
  }, []);

  // Focus a specific element
  const focusElement = useCallback((selector: string | HTMLElement) => {
    let element: HTMLElement | null;

    if (typeof selector === 'string') {
      element = containerRef.current?.querySelector<HTMLElement>(selector) ||
                document.querySelector<HTMLElement>(selector);
    } else {
      element = selector;
    }

    element?.focus();
  }, []);

  // Focus first focusable element
  const focusFirst = useCallback(() => {
    if (!containerRef.current) return;
    const firstFocusable = containerRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTORS);
    firstFocusable?.focus();
  }, []);

  // Focus last focusable element
  const focusLast = useCallback(() => {
    if (!containerRef.current) return;
    const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
    const lastFocusable = focusableElements[focusableElements.length - 1];
    lastFocusable?.focus();
  }, []);

  return {
    prefersReducedMotion,
    prefersHighContrast,
    containerRef,
    announce,
    focusElement,
    focusFirst,
    focusLast,
    announcement,
    announcementPoliteness
  };
}

/**
 * Hook for detecting reduced motion preference
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  return prefersReducedMotion;
}

/**
 * Hook for simple screen reader announcements
 */
export function useAnnounce() {
  const [announcement, setAnnouncement] = useState<{
    message: string;
    politeness: 'polite' | 'assertive';
  } | null>(null);

  const announce = useCallback((message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    // Clear first
    setAnnouncement(null);
    // Then set new announcement
    setTimeout(() => setAnnouncement({ message, politeness }), 50);
  }, []);

  const clear = useCallback(() => {
    setAnnouncement(null);
  }, []);

  return { announcement, announce, clear };
}

export default useAccessibility;
