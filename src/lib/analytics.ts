/**
 * Google Analytics initialization and utilities
 * Moved from inline script for CSP compliance
 */

// Declare gtag global function
declare global {
  interface Window {
    dataLayer: any[];
    gtag: (...args: any[]) => void;
  }
}

/**
 * Initialize Google Analytics
 * Loads gtag.js and configures GA4
 */
export function initGoogleAnalytics() {
  // Skip in development or if GA ID not configured
  const GA_ID = 'G-8R95ZXMV6L';

  if (import.meta.env.DEV) {
    console.log('[Analytics] Skipping GA initialization in development mode');
    return;
  }

  if (!GA_ID) {
    console.warn('[Analytics] Google Analytics ID not configured');
    return;
  }

  try {
    // Initialize dataLayer
    window.dataLayer = window.dataLayer || [];

    // Define gtag function
    window.gtag = function gtag(...args: any[]) {
      window.dataLayer.push(args);
    };

    // Initialize gtag with current timestamp
    window.gtag('js', new Date());

    // Configure GA4
    window.gtag('config', GA_ID, {
      send_page_view: true,
      anonymize_ip: true, // GDPR compliance
    });

    // Load gtag.js script dynamically
    const script = document.createElement('script');
    script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);

    console.log('[Analytics] Google Analytics initialized');
  } catch (error) {
    console.error('[Analytics] Failed to initialize Google Analytics:', error);
  }
}

/**
 * Track custom events
 */
export function trackEvent(
  eventName: string,
  eventParams?: Record<string, any>
) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, eventParams);
  }
}

/**
 * Track page views
 */
export function trackPageView(
  pageTitle: string,
  pagePath: string
) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_title: pageTitle,
      page_path: pagePath,
    });
  }
}
