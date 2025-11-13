import { useState, useEffect } from 'react';
import { useReadingProgress } from '@/hooks/useReadingProgress';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Enhanced reading progress bar component
 * Shows a fixed progress bar at the top of the page indicating scroll position
 * Includes scroll-to-top button when user has scrolled down
 */
export const ReadingProgress = () => {
  const progress = useReadingProgress();
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show scroll-to-top button after scrolling down 20%
      setShowScrollTop(progress > 20);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [progress]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  return (
    <>
      {/* Progress bar */}
      <div
        className="fixed top-0 left-0 right-0 h-1 bg-transparent z-50 pointer-events-none"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Reading progress"
      >
        <div
          className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600 transition-all duration-150 ease-out shadow-lg shadow-primary/50"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Scroll to top button */}
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          size="icon"
          className="fixed bottom-8 right-8 z-50 shadow-lg rounded-full w-12 h-12 transition-all duration-200 hover:scale-110 group"
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-5 h-5 group-hover:animate-bounce" />
        </Button>
      )}
    </>
  );
};
