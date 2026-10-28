import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initSentry } from './lib/sentry';
import { initPerformanceMonitoring } from './lib/performance';
import { registerServiceWorker } from './lib/registerSW';
import { initErrorTracking } from './lib/error-tracking';
import { initErrorAlerting, connectToErrorTracking } from './lib/error-alerting';
import { initGoogleAnalytics } from './lib/analytics';
import { initConsent } from './lib/consent';
import { preloadPrerenderedRoute } from './lib/routeComponents';

// Apply any previously stored cookie-consent decision to Google Consent Mode
// before other trackers initialize. No-op (leaving the denied default from
// index.html in place) when the visitor has not yet chosen.
initConsent();

// Initialize Sentry first so it can capture the earliest errors (no-op if
// VITE_SENTRY_DSN is not configured, or if functional consent is not granted).
initSentry();

// Initialize error tracking first to capture any initialization errors
initErrorTracking();

// Initialize error alerting with default thresholds
// Can be customized via environment variables
initErrorAlerting({
  errorRateWarningThreshold: 10, // 10 errors/min triggers warning
  errorRateCriticalThreshold: 50, // 50 errors/min triggers critical
  cooldownMinutes: 15, // 15 min between alerts
  enableEmail: true, // Enable email alerts
  alertEmails: ['admin@danpearson.net'], // Alert recipients
});

// Connect error alerting to error tracking
connectToErrorTracking();

// Initialize performance monitoring for Core Web Vitals
initPerformanceMonitoring();

// Initialize Google Analytics (CSP-compliant, non-blocking)
initGoogleAnalytics();

// Register Service Worker for PWA offline support
registerServiceWorker();

// scripts/prerender.mjs paints real HTML into #root for the article, money and
// topic-hub routes. Those pages are lazy chunks, so rendering immediately would
// commit the Suspense skeleton over that content. Wait (at most 1.5s) for the
// entry route's chunk first; createRoot leaves the prerendered markup on screen
// until the first commit. Index ('/') is eager and renders without waiting.
const root = createRoot(document.getElementById('root')!);
const entryPreload = preloadPrerenderedRoute(window.location.pathname);
if (entryPreload) {
  void entryPreload.then(() => root.render(<App />));
} else {
  root.render(<App />);
}
