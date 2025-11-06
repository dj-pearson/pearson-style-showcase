import { useEffect } from 'react';
import { logger } from "@/lib/logger";
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

interface AnalyticsProps {
  trackingId?: string;
}

interface AnalyticsSettings {
  google_analytics_id: string | null;
  enabled: boolean;
}

// Custom hook for analytics
export const useAnalytics = () => {
  const location = useLocation();

  useEffect(() => {
    if (typeof window !== 'undefined' && window.gtag) {
      // Fetch tracking ID from database
      const fetchTrackingId = async () => {
        const { data } = await supabase
          .from('analytics_settings')
          .select('google_analytics_id, enabled')
          .single();

        if (data?.enabled && data?.google_analytics_id) {
          window.gtag('config', data.google_analytics_id, {
            page_path: location.pathname,
          });
          
          // Track page view
          window.gtag('event', 'page_view', {
            page_title: document.title,
            page_location: window.location.href,
            page_path: location.pathname,
          });
        }
      };

      fetchTrackingId();
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

const Analytics = ({ trackingId: propTrackingId }: AnalyticsProps) => {
  useEffect(() => {
    const initializeAnalytics = async () => {
      // Fetch configuration from database
      const { data: settings } = await supabase
        .from('analytics_settings')
        .select('google_analytics_id, enabled')
        .single();

      // Use database config or fallback to prop
      const trackingId = settings?.google_analytics_id || propTrackingId;
      const isEnabled = settings?.enabled ?? false;

      // Only load if enabled and has valid tracking ID
      if (isEnabled && trackingId && trackingId !== 'G-XXXXXXXXXX') {
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

        logger.log('📊 Analytics initialized with tracking ID:', trackingId);
      }
    };

    initializeAnalytics();
  }, [propTrackingId]);

  return null;
};

export default Analytics;
