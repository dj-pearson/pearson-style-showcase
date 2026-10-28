import { useEffect, useRef } from 'react';
import { useAnalytics } from './Analytics';

const ScrollTracker = () => {
  // Milestones live in a ref so reaching one doesn't re-run the effect and
  // rebind the scroll listener; trackScroll is read through a ref for the
  // same reason (useAnalytics returns fresh functions each render).
  const milestonesRef = useRef(new Set<number>());
  const { trackScroll } = useAnalytics();
  const trackScrollRef = useRef(trackScroll);
  trackScrollRef.current = trackScroll;

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;

      const totalScrollable = documentHeight - windowHeight;
      const percentage = Math.round((scrollTop / totalScrollable) * 100);

      // Track scroll milestones
      const milestonePoints = [25, 50, 75, 90, 100];
      milestonePoints.forEach((point) => {
        if (percentage >= point && !milestonesRef.current.has(point)) {
          milestonesRef.current.add(point);
          trackScrollRef.current(point);
        }
      });
    };

    const throttledScroll = throttle(handleScroll, 100);
    window.addEventListener('scroll', throttledScroll, { passive: true });

    return () => window.removeEventListener('scroll', throttledScroll);
  }, []);

  return null;
};

// Throttle function for performance
const throttle = <T extends (...args: unknown[]) => void>(func: T, delay: number) => {
  let timeoutId: NodeJS.Timeout;
  let lastExecTime = 0;

  return function (...args: Parameters<T>) {
    const currentTime = Date.now();

    if (currentTime - lastExecTime > delay) {
      func(...args);
      lastExecTime = currentTime;
    } else {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(
        () => {
          func(...args);
          lastExecTime = Date.now();
        },
        delay - (currentTime - lastExecTime)
      );
    }
  };
};

export default ScrollTracker;
