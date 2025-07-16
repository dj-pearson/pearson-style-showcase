import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

interface AnalyticsProps {
  trackingId?: string;
}

// Custom hook for analytics
export const useAnalytics = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('config', 'GA_MEASUREMENT_ID', {
        page_path: location.pathname,
      });
      
      // Track page view
      window.gtag('event', 'page_view', {
        page_title: document.title,
        page_location: window.location.href,
        page_path: location.pathname,
      });
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

const Analytics = ({ trackingId = 'G-XXXXXXXXXX' }: AnalyticsProps) => {
  useEffect(() => {
    // Only load in production or when tracking ID is provided
    if (process.env.NODE_ENV === 'production' || trackingId !== 'G-XXXXXXXXXX') {
      // Load Google Analytics script
      const script1 = document.createElement('script');
      script1.async = true;
      script1.src = `https://www.googletagmanager.com/gtag/js?id=${trackingId}`;
      document.head.appendChild(script1);

      // Initialize gtag
      window.dataLayer = window.dataLayer || [];
      function gtag(...args: any[]) {
        window.dataLayer.push(args);
      }
      window.gtag = gtag;

      gtag('js', new Date());
      gtag('config', trackingId, {
        page_title: document.title,
        page_location: window.location.href,
      });

      // Track initial page load
      gtag('event', 'page_view', {
        page_title: document.title,
        page_location: window.location.href,
      });

      console.log('📊 Analytics initialized');
    }
  }, [trackingId]);

  return null;
};

export default Analytics;