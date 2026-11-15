import { useReadingProgress } from '@/hooks/useReadingProgress';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/components/ui/button';

// True when either the OS setting or the in-app accessibility toggle (which
// sets .a11y-reduced-motion on <html>) asks for less motion.
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    document.documentElement.classList.contains('a11y-reduced-motion') ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/**
 * Fixed reading progress bar at the top of the page, plus a scroll-to-top
 * button once the reader is 20% of the way down.
 */
export const ReadingProgress = () => {
  const progress = useReadingProgress();
  const showScrollTop = progress > 20;

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
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
          className="h-full w-full origin-left bg-primary transition-transform duration-150 ease-out motion-reduce:transition-none"
          style={{ transform: `scaleX(${progress / 100})` }}
        />
      </div>

      {/* Scroll to top button. Sits above the accessibility widget button
          (56px at bottom-6 right-6), centred on the same vertical line, and
          moves up with it while the cookie banner is showing. */}
      {showScrollTop && (
        <Button
          onClick={scrollToTop}
          size="icon"
          className="fixed bottom-[calc(6rem+var(--cookie-banner-offset,0px))] right-7 z-50 shadow-lg rounded-full w-12 h-12"
          aria-label="Scroll to top"
        >
          <ArrowUp className="w-5 h-5" aria-hidden="true" />
        </Button>
      )}
    </>
  );
};
