import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { hasConsent } from '@/lib/consent';
import { shouldSuppressForOddTraffic } from '@/lib/traffic-detection';

/*
 * GA4 tracking. public/gtag-init.js defines window.gtag and the Consent Mode
 * defaults; src/lib/consent.ts loads gtag.js only once analytics consent is
 * granted. Every call here also checks consent at call time, so nothing is
 * queued for a visitor who has not opted in (or who has since opted out).
 */

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

/** Query parameters that carry credentials and must never reach GA. */
const SENSITIVE_PARAMS = ['token', 'code', 'access_token', 'refresh_token'];

/** Lead value sent with generate_lead. A placeholder weight, not revenue. */
const LEAD_VALUE = 1;

const SEARCH_TERM_MAX = 100;

function isUnderSegment(pathname: string, segment: string): boolean {
  return pathname === segment || pathname.startsWith(`${segment}/`);
}

/**
 * The page_location to report for a URL, or null when the page must not be
 * tracked at all. Admin and auth pages are skipped; newsletter pages drop the
 * whole query (their links carry one-time tokens); everywhere else the
 * credential-bearing params are removed. The hash is always dropped, since
 * Supabase puts access tokens there on OAuth redirects.
 */
export function sanitizePageLocation(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const { pathname } = url;
  if (isUnderSegment(pathname, '/admin') || isUnderSegment(pathname, '/auth')) return null;
  if (isUnderSegment(pathname, '/newsletter')) return `${url.origin}${pathname}`;

  for (const name of SENSITIVE_PARAMS) url.searchParams.delete(name);
  url.hash = '';
  return url.toString();
}

/**
 * Sends one GA event if the visitor allows it. Every event carries a
 * sanitized page_location, because gtag otherwise attaches the raw URL
 * (tokens included) on its own.
 */
function sendEvent(name: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
  if (!hasConsent('analytics')) return;
  // Keep odd/flagged traffic (e.g. bot floods from unexpected countries)
  // out of Google Analytics so the metrics reflect real visitors.
  if (shouldSuppressForOddTraffic()) return;
  const pageLocation = sanitizePageLocation(window.location.href);
  if (!pageLocation) return;
  window.gtag('event', name, { ...params, page_location: pageLocation });
}

/** Legacy positional event: (action, category, label, value). */
export function trackEvent(action: string, category: string, label?: string, value?: number) {
  sendEvent(action, { event_category: category, event_label: label, value });
}

export function trackClick(element: string, location?: string) {
  trackEvent('click', 'User Interaction', `${element}${location ? ` - ${location}` : ''}`);
}

export function trackDownload(fileName: string) {
  trackEvent('download', 'File', fileName);
}

/** Scroll milestone. Not `scroll`, which GA4 Enhanced Measurement already sends. */
export function trackScroll(percent: number) {
  sendEvent('scroll_depth', { percent });
}

export function trackConversion(conversionType: string, label?: string, value?: number) {
  trackEvent('conversion', conversionType, label, value);
}

/**
 * Newsletter request funnel. A successful request only means a confirmation
 * email went out, so it counts as sign_up; the lead is counted on confirm.
 */
export function trackNewsletterSignup(status: 'attempt' | 'success' | 'failure') {
  trackEvent(`newsletter_${status}`, 'Newsletter', `Newsletter signup ${status}`);
  if (status === 'success') sendEvent('sign_up', { method: 'newsletter' });
}

/** The subscriber clicked the opt-in link and the address is now confirmed. */
export function trackNewsletterConfirmed() {
  sendEvent('generate_lead', {
    lead_source: 'newsletter_confirmed',
    currency: 'USD',
    value: LEAD_VALUE,
  });
}

export function trackContactForm(status: 'start' | 'submit' | 'success' | 'failure') {
  trackEvent(`contact_form_${status}`, 'Contact', `Contact form ${status}`);
  if (status === 'success') {
    sendEvent('generate_lead', { lead_source: 'contact_form', currency: 'USD', value: LEAD_VALUE });
  }
}

export function trackOutboundLink(url: string, label?: string) {
  trackEvent('outbound_click', 'Outbound Link', label || url);
}

/** A call-to-action click. `location` names where on the site it sits. */
export function trackCTA(name: string, location: string, linkUrl?: string) {
  sendEvent('cta_click', { cta_name: name, cta_location: location, link_url: linkUrl });
}

/** A search the visitor settled on. Empty terms are ignored; long ones are capped. */
export function trackSearch(term: string, source: 'search_page' | 'palette') {
  const searchTerm = term.trim().slice(0, SEARCH_TERM_MAX);
  if (!searchTerm) return;
  sendEvent('search', { search_term: searchTerm, search_source: source });
}

/** Call only after the share actually happened (sheet resolved, copy resolved, window opened). */
export function trackShare(method: string, slug: string) {
  sendEvent('share', { method, content_type: 'article', item_id: slug });
}

/**
 * Sends one GA page_view per route change. Mounted only by <Analytics />, so
 * calling useAnalytics() from pages or trackers does not multiply page views.
 * Keyed on pathname alone: Search rewrites ?q= as the visitor types, and each
 * rewrite used to count as a page view.
 */
export const usePageViewTracking = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    const trackPageView = () => {
      if (typeof window === 'undefined' || typeof window.gtag !== 'function') return;
      if (!hasConsent('analytics') || shouldSuppressForOddTraffic()) return;
      const pageLocation = sanitizePageLocation(window.location.href);
      if (!pageLocation) return;

      // 'set' rather than 'config': a config call sends its own page_view,
      // which doubled every navigation with the explicit event below.
      window.gtag('set', { page_path: pathname });
      window.gtag('event', 'page_view', {
        page_title: document.title,
        page_location: pageLocation,
        page_path: pathname,
      });
    };

    // Defer to idle time to avoid blocking FCP/LCP
    if (typeof window.requestIdleCallback === 'function') {
      const handle = window.requestIdleCallback(trackPageView, { timeout: 2000 });
      return () => window.cancelIdleCallback(handle);
    }
    // Fallback for Safari
    const timer = setTimeout(trackPageView, 100);
    return () => clearTimeout(timer);
  }, [pathname]);
};

const helpers = {
  trackEvent,
  trackClick,
  trackDownload,
  trackScroll,
  trackConversion,
  trackNewsletterSignup,
  trackNewsletterConfirmed,
  trackContactForm,
  trackOutboundLink,
  trackCTA,
  trackSearch,
  trackShare,
};

/**
 * Event-tracking helpers. No side effects of its own, so any component can
 * call it without sending page views. The returned functions are stable.
 */
export const useAnalytics = () => helpers;

/** Mounted once in App: sends page views. */
const Analytics = () => {
  usePageViewTracking();
  return null;
};

export default Analytics;
