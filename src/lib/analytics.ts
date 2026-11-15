/**
 * Google Analytics helpers.
 *
 * gtag is set up entirely by public/gtag-init.js (loaded from index.html): it
 * defines dataLayer and gtag(), queues the Consent Mode defaults, configures
 * GA4 with send_page_view off and then injects gtag.js. Page views come from
 * src/components/Analytics.tsx. Nothing here loads or configures gtag; an
 * earlier initGoogleAnalytics() did, which loaded gtag.js a second time,
 * replaced window.gtag with a version gtag.js does not read, and sent a
 * duplicate page_view on every page load.
 */

declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

/**
 * Track custom events
 */
export function trackEvent(eventName: string, eventParams?: Record<string, unknown>) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, eventParams);
  }
}

/**
 * Track page views
 */
export function trackPageView(pageTitle: string, pagePath: string) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'page_view', {
      page_title: pageTitle,
      page_path: pagePath,
    });
  }
}
