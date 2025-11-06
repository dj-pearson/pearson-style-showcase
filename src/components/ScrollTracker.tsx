import { useEffect, useState } from 'react';
import { useAnalytics } from './Analytics';

const ScrollTracker = () => {
  const [scrollPercentage, setScrollPercentage] = useState(0);
  const [milestones, setMilestones] = useState(new Set<number>());
  const { trackScroll } = useAnalytics();

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.pageYOffset;
      const windowHeight = window.innerHeight;
      const documentHeight = document.documentElement.scrollHeight;
      
      const totalScrollable = documentHeight - windowHeight;
      const percentage = Math.round((scrollTop / totalScrollable) * 100);
      
      setScrollPercentage(percentage);

      // Track scroll milestones
      const milestonePoints = [25, 50, 75, 90, 100];
      milestonePoints.forEach(point => {
        if (percentage >= point && !milestones.has(point)) {
          setMilestones(prev => new Set(prev).add(point));
          trackScroll(point);
        }
      });
    };

    const throttledScroll = throttle(handleScroll, 100);
    window.addEventListener('scroll', throttledScroll, { passive: true });
    
    return () => window.removeEventListener('scroll', throttledScroll);
  }, [milestones, trackScroll]);

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
      timeoutId = setTimeout(() => {
        func(...args);
        lastExecTime = Date.now();
      }, delay - (currentTime - lastExecTime));
    }
  };
};

export default ScrollTracker;