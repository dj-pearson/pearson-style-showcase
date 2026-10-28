import { useEffect } from 'react';
import { logger } from '@/lib/logger';
import { useLocation } from 'react-router-dom';
import { shouldSuppressForOddTraffic } from '@/lib/traffic-detection';

// Tracking ID is loaded via index.html script tags - no need for Supabase query

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

interface AnalyticsProps {
  trackingId?: string;
}

/**
 * Sends one GA page_view per route change. Mounted only by <Analytics />, so
 * calling useAnalytics() from pages or trackers no longer multiplies page
 * views (Index + ScrollTracker + Analytics used to send three per navigation).
 */
export const usePageViewTracking = () => {
  const location = useLocation();

  useEffect(() => {
    const trackPageView = () => {
      // Keep odd/flagged traffic (e.g. bot floods from unexpected countries)
      // out of Google Analytics so the metrics reflect real visitors.
      if (shouldSuppressForOddTraffic()) return;
      if (typeof window !== 'undefined' && window.gtag) {
        // 'set' rather than 'config': a config call sends its own page_view,
        // which doubled every navigation with the explicit event below.
        window.gtag('set', { page_path: location.pathname });

        window.gtag('event', 'page_view', {
          page_title: document.title,
          page_location: window.location.href,
          page_path: location.pathname,
        });
      }
    };

    // Defer to idle time to avoid blocking FCP/LCP
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(trackPageView, { timeout: 2000 });
      return () => window.cancelIdleCallback(handle);
    }
    // Fallback for Safari
    const timer = setTimeout(trackPageView, 100);
    return () => clearTimeout(timer);
  }, [location.pathname, location.search]);
};

/**
 * Event-tracking helpers. Has no side effects of its own, so any component
 * can call it without sending extra page views.
 */
export const useAnalytics = () => {
  // Track custom events
  const trackEvent = (action: string, category: string, label?: string, value?: number) => {
    if (shouldSuppressForOddTraffic()) return;
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

  // Conversion tracking methods
  const trackConversion = (conversionType: string, label?: string, value?: number) => {
    trackEvent('conversion', conversionType, label, value);
  };

  const trackNewsletterSignup = (status: 'attempt' | 'success' | 'failure') => {
    trackEvent(`newsletter_${status}`, 'Newsletter', `Newsletter signup ${status}`);
    if (status === 'success') {
      trackEvent('generate_lead', 'Newsletter', 'Newsletter subscription', 1);
    }
  };

  const trackContactForm = (status: 'start' | 'submit' | 'success' | 'failure') => {
    trackEvent(`contact_form_${status}`, 'Contact', `Contact form ${status}`);
    if (status === 'success') {
      trackEvent('generate_lead', 'Contact', 'Contact form submission', 1);
    }
  };

  const trackBookingIntent = (method: string) => {
    trackEvent('booking_intent', 'Booking', `Booking via ${method}`, 1);
  };

  const trackOutboundLink = (url: string, label?: string) => {
    trackEvent('outbound_click', 'Outbound Link', label || url);
  };

  const trackCTA = (ctaName: string, pageName: string) => {
    trackEvent('cta_click', 'CTA', `${ctaName} - ${pageName}`, 1);
  };

  return {
    trackEvent,
    trackClick,
    trackDownload,
    trackScroll,
    trackConversion,
    trackNewsletterSignup,
    trackContactForm,
    trackBookingIntent,
    trackOutboundLink,
    trackCTA,
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
  usePageViewTracking();

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
