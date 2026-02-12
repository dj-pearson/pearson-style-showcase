import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * RouteAnnouncer - Manages focus and screen reader announcements on route changes.
 *
 * WCAG 2.4.3 (Focus Order) & WCAG 4.1.3 (Status Messages):
 * - Announces page title changes to screen readers
 * - Moves focus to main content after navigation
 * - Ensures keyboard users aren't lost after route transitions
 */
const RouteAnnouncer: React.FC = () => {
  const location = useLocation();
  const announcerRef = useRef<HTMLDivElement>(null);
  const previousPathRef = useRef(location.pathname);

  useEffect(() => {
    // Skip on initial mount
    if (previousPathRef.current === location.pathname) return;
    previousPathRef.current = location.pathname;

    // Short delay to allow the new page to render and update document.title
    const timer = setTimeout(() => {
      // Announce the new page title to screen readers
      if (announcerRef.current) {
        const pageTitle = document.title || 'Page loaded';
        announcerRef.current.textContent = '';
        // Force re-announcement
        requestAnimationFrame(() => {
          if (announcerRef.current) {
            announcerRef.current.textContent = `Navigated to ${pageTitle}`;
          }
        });
      }

      // Move focus to the main content area
      const mainContent = document.getElementById('main-content');
      if (mainContent) {
        // Set tabindex temporarily so it can receive focus
        if (!mainContent.hasAttribute('tabindex')) {
          mainContent.setAttribute('tabindex', '-1');
          mainContent.style.outline = 'none';
        }
        mainContent.focus({ preventScroll: false });
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [location.pathname]);

  return (
    <div
      ref={announcerRef}
      role="status"
      aria-live="assertive"
      aria-atomic="true"
      className="sr-only"
    />
  );
};

export default RouteAnnouncer;
