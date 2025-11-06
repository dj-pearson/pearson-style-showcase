import { useState, useEffect } from 'react';

/**
 * Custom hook to track reading progress on a page
 * Returns a percentage (0-100) of how far the user has scrolled
 */
export const useReadingProgress = () => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const updateProgress = () => {
      // Get scroll position
      const scrollTop = window.scrollY;
      // Get total scrollable height
      const docHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      // Calculate progress percentage
      const scrollPercent = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

      setProgress(scrollPercent);
    };

    // Update on scroll
    window.addEventListener('scroll', updateProgress, { passive: true });

    // Initial calculation
    updateProgress();

    return () => window.removeEventListener('scroll', updateProgress);
  }, []);

  return progress;
};
