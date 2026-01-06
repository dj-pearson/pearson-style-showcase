import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to track reading progress on a page
 * Returns a percentage (0-100) of how far the user has scrolled
 * Uses requestAnimationFrame throttling for optimal performance
 */
export const useReadingProgress = () => {
  const [progress, setProgress] = useState(0);
  const rafIdRef = useRef<number | null>(null);
  const lastProgressRef = useRef(0);

  useEffect(() => {
    const calculateProgress = () => {
      // Get scroll position
      const scrollTop = window.scrollY;
      // Get total scrollable height
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      // Calculate progress percentage
      const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

      // Only update state if progress changed by at least 0.5% to reduce re-renders
      if (Math.abs(scrollPercent - lastProgressRef.current) >= 0.5) {
        lastProgressRef.current = scrollPercent;
        setProgress(scrollPercent);
      }

      rafIdRef.current = null;
    };

    const handleScroll = () => {
      // Throttle using requestAnimationFrame - only calculate once per frame
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(calculateProgress);
      }
    };

    // Update on scroll
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Initial calculation
    calculateProgress();

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return progress;
};
