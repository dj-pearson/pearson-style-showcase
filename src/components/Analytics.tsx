import { useEffect } from 'react';
import { logger } from "@/lib/logger";
import { useLocation } from 'react-router-dom';

// Tracking ID is loaded via index.html script tags - no need for Supabase query
const TRACKING_ID = 'G-8R95ZXMV6L';

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

interface AnalyticsProps {
  trackingId?: string;
}


// Custom hook for analytics - optimized to avoid blocking page loads
export const useAnalytics = () => {
  const location = useLocation();

  useEffect(() => {
    // Use requestIdleCallback to defer analytics to idle time
    const trackPageView = () => {
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('config', TRACKING_ID, {
          page_path: location.pathname,
        });

        window.gtag('event', 'page_view', {
          page_title: document.title,
          page_location: window.location.href,
          page_path: location.pathname,
        });
      }
    };

    // Defer to idle time to avoid blocking FCP/LCP
    if ('requestIdleCallback' in window) {
      (window as any).requestIdleCallback(trackPageView, { timeout: 2000 });
    } else {
      // Fallback for Safari
      setTimeout(trackPageView, 100);
    }
  }, [location]);

  // Track custom events
  const trackEvent = (action: string, category: string, label?: string, value?: number) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', action, {
        event_category: category,
        event_label: label,
        value: value,
      });
    }
  };

  // Track user interactions
  const trackClick = (element: string, location?: string) => {
    trackEvent('click', 'User Interaction', `${element}${location ? ` - ${location}` : ''}`);
  };

  const trackDownload = (fileName: string) => {
    trackEvent('download', 'File', fileName);
  };

  const trackScroll = (percentage: number) => {
    trackEvent('scroll', 'User Engagement', `${percentage}% scrolled`);
  };

  return {
    trackEvent,
    trackClick,
    trackDownload,
    trackScroll,
  };
};

/**
 * Analytics Component
 *
 * NOTE: Google Analytics is now loaded directly in index.html for optimal performance.
 * This component is kept for backwards compatibility but no longer loads scripts dynamically.
 * The tracking ID (G-8R95ZXMV6L) is hardcoded in index.html to avoid Supabase queries
 * on every page load, which was causing 200-500ms delays in FCP/LCP.
 */
const Analytics = ({ trackingId: propTrackingId }: AnalyticsProps) => {
  useEffect(() => {
    // Analytics is already initialized in index.html
    // This effect just logs for debugging purposes in development
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      logger.log('📊 Analytics already initialized via index.html');
    }
  }, [propTrackingId]);

  return null;
};

export default Analytics;
